"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { acceptTeacherInvitationSchema } from "../schemas";
import { hashInviteToken } from "../inviteTokens";
import { checkRateLimit, getClientIp } from "../rateLimit";
import { linkSpecificMeetingBlocks } from "../manualInvite";
import { normalizeEmail } from "../lookupTeacherCandidate";

export interface AcceptTeacherInvitationState {
  error?: string;
}

async function linkPendingClasses(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teacherId: string,
  classIds: string[],
) {
  for (const classId of classIds) {
    const { error } = await admin.from("teacher_assignments").insert({
      teacher_id: teacherId,
      class_id: classId,
      function: "regente",
    });
    // 23505 = vínculo já existe (não deveria acontecer para conta nova,
    // mas é inofensivo ignorar) — qualquer outro erro só vira um aviso
    // silencioso: a conta e a senha já existem, não vale a pena falhar o
    // onboarding inteiro por uma turma que a coordenação pode vincular
    // manualmente depois.
    if (error && error.code !== "23505") {
      console.error("Falha ao vincular turma no primeiro acesso do professor:", error);
    }
  }
}

/**
 * Consome o convite manual: só é chamado por uma Server Action disparada
 * por submit explícito (nunca por uma requisição GET — ver página pública
 * em src/app/(public)/convite-professor/[token]/page.tsx, que só LÊ o
 * estado do token, nunca escreve).
 */
export async function acceptTeacherInvitation(
  _prevState: AcceptTeacherInvitationState,
  formData: FormData,
): Promise<AcceptTeacherInvitationState> {
  const parsed = acceptTeacherInvitationSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const submittedEmail = normalizeEmail(parsed.data.email);

  const admin = createSupabaseAdminClient();

  const ip = await getClientIp();
  const okToTry = await checkRateLimit(admin, `accept-teacher-invite:${ip}`, 10, 600);
  if (!okToTry) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  // Reivindicação atômica: só um submit concorrente consegue marcar
  // consumed_at. status/accepted_at (legado) ficam intocados de propósito
  // — handle_new_user ainda precisa encontrar esta linha como "pending"
  // quando admin.createUser() disparar o trigger logo abaixo. O e-mail
  // também é corrigido aqui, ANTES do createUser: a coordenação pode ter
  // usado um e-mail provisório ao gerar o convite (ex.: sem saber o real
  // ainda) — o trigger casa por e-mail, então precisa ver o valor final.
  const { data: claimed, error: claimError } = await admin
    .from("invitations")
    .update({ consumed_at: new Date().toISOString(), email: submittedEmail })
    .eq("token_hash", tokenHash)
    .eq("channel", "manual_link")
    .eq("purpose", "teacher_onboarding")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("token_expires_at", new Date().toISOString())
    .select("id, class_ids, meeting_block_ids")
    .maybeSingle();

  if (claimError) {
    return { error: "Não foi possível processar seu cadastro. Tente novamente." };
  }

  if (!claimed) {
    // Descobre o motivo só para dar uma mensagem útil — não revela nada
    // sensível (o token já é conhecido por quem está chamando isto).
    const { data: existing } = await admin
      .from("invitations")
      .select("revoked_at, consumed_at, token_expires_at")
      .eq("token_hash", tokenHash)
      .eq("channel", "manual_link")
      .maybeSingle();

    if (!existing) {
      return { error: "Link inválido. Peça um novo convite à coordenação." };
    }
    if (existing.revoked_at) {
      return { error: "Este link foi revogado. Peça um novo convite à coordenação." };
    }
    if (existing.consumed_at) {
      return { error: "Este link já foi utilizado. Se você já tem senha, faça login." };
    }
    return { error: "Este link expirou. Peça um novo convite à coordenação." };
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: submittedEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !createdUser.user) {
    // Caso raro (corrida: a conta passou a existir entre o convite e o
    // aceite). O token já foi consumido — a coordenação precisa gerar um
    // novo caminho de acesso (vínculo direto ou recuperação assistida),
    // não repetir esta tela.
    return {
      error:
        createError?.message.toLowerCase().includes("already")
          ? "Já existe uma conta com este e-mail. Peça à coordenação para te orientar " +
            "a fazer login ou recuperar a senha."
          : "Não foi possível criar sua conta agora. Avise a coordenação.",
    };
  }

  const teacherId = createdUser.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", teacherId);

  if (profileError) {
    console.error("Falha ao finalizar profile no primeiro acesso do professor:", profileError);
  }

  await linkPendingClasses(admin, teacherId, claimed.class_ids ?? []);
  await linkSpecificMeetingBlocks(admin, teacherId, claimed.meeting_block_ids ?? []);

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: submittedEmail,
    password: parsed.data.password,
  });

  if (signInError) {
    // A conta e a senha já existem e estão corretas — isto seria um erro de
    // infraestrutura, não do professor. Manda para o login normal em vez de
    // deixar a pessoa presa numa tela de erro sem saída.
    redirect("/login");
  }

  redirect("/professor");
}
