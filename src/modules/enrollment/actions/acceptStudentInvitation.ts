"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { acceptStudentInvitationSchema } from "../schemas";
import { hashInviteToken } from "@/modules/auth/inviteTokens";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { normalizeEmail } from "@/modules/auth/lookupTeacherCandidate";

export interface AcceptStudentInvitationState {
  error?: string;
}

/**
 * Cria a matrícula (enrollments) para cada turma gravada no convite — só é
 * possível agora, porque é aqui que `student_id` passa a existir. Nunca
 * sobrescreve nada: se por algum motivo já existir matrícula na mesma
 * turma, ignora (23505).
 */
async function createEnrollments(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  studentId: string,
  classIds: string[],
  authorizedBy: string,
  authorizedAt: string,
) {
  for (const classId of classIds) {
    const { data: klass } = await admin
      .from("classes")
      .select("season_volume_offering_id")
      .eq("id", classId)
      .maybeSingle();
    if (!klass) continue;

    const { error } = await admin.from("enrollments").insert({
      student_id: studentId,
      class_id: classId,
      season_volume_offering_id: klass.season_volume_offering_id,
      status: "active",
      authorized_by: authorizedBy,
      authorized_at: authorizedAt,
    });
    if (error && error.code !== "23505") {
      console.error("Falha ao criar matrícula no primeiro acesso do aluno:", error);
    }
  }
}

/**
 * Consome o convite de primeiro acesso do aluno (enviado por e-mail) — só
 * é chamado por submit explícito, nunca por GET (ver página pública em
 * src/app/(public)/convite-aluno/[token]/page.tsx).
 */
export async function acceptStudentInvitation(
  _prevState: AcceptStudentInvitationState,
  formData: FormData,
): Promise<AcceptStudentInvitationState> {
  const parsed = acceptStudentInvitationSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const submittedEmail = normalizeEmail(parsed.data.email);
  const admin = createSupabaseAdminClient();

  const ip = await getClientIp();
  const okToTry = await checkRateLimit(admin, `accept-student-invite:${ip}`, 10, 600);
  if (!okToTry) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  const { data: claimed, error: claimError } = await admin
    .from("invitations")
    .update({ consumed_at: new Date().toISOString(), email: submittedEmail })
    .eq("token_hash", tokenHash)
    .eq("channel", "email")
    .eq("purpose", "student_onboarding")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("token_expires_at", new Date().toISOString())
    .select("id, class_ids, enrollment_request_id")
    .maybeSingle();

  if (claimError) {
    return { error: "Não foi possível processar seu cadastro. Tente novamente." };
  }

  if (!claimed) {
    const { data: existing } = await admin
      .from("invitations")
      .select("revoked_at, consumed_at, token_expires_at")
      .eq("token_hash", tokenHash)
      .eq("channel", "email")
      .maybeSingle();

    if (!existing) {
      return { error: "Link inválido. Peça um novo acesso à coordenação." };
    }
    if (existing.revoked_at) {
      return { error: "Este link foi revogado. Peça um novo acesso à coordenação." };
    }
    if (existing.consumed_at) {
      return { error: "Este link já foi utilizado. Se você já tem senha, faça login." };
    }
    return { error: "Este link expirou. Peça um novo acesso à coordenação." };
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: submittedEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !createdUser.user) {
    return {
      error:
        createError?.message.toLowerCase().includes("already")
          ? "Já existe uma conta com este e-mail. Peça à coordenação para te orientar " +
            "a fazer login ou recuperar a senha."
          : "Não foi possível criar sua conta agora. Avise a coordenação.",
    };
  }

  const studentId = createdUser.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName, onboarding_completed_at: new Date().toISOString() })
    .eq("id", studentId);

  if (profileError) {
    console.error("Falha ao finalizar profile no primeiro acesso do aluno:", profileError);
  }

  let authorizedBy = studentId;
  let authorizedAt = new Date().toISOString();
  if (claimed.enrollment_request_id) {
    const { data: request } = await admin
      .from("enrollment_requests")
      .select("reviewed_by, reviewed_at")
      .eq("id", claimed.enrollment_request_id)
      .maybeSingle();
    if (request?.reviewed_by) authorizedBy = request.reviewed_by;
    if (request?.reviewed_at) authorizedAt = request.reviewed_at;
  }

  await createEnrollments(admin, studentId, claimed.class_ids ?? [], authorizedBy, authorizedAt);

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: submittedEmail,
    password: parsed.data.password,
  });

  if (signInError) {
    redirect("/login");
  }

  redirect("/meus-volumes");
}
