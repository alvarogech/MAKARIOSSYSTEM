"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { findUserIdByEmailAndRole } from "@/modules/academic/lookupUser";
import { grantLateReleaseSchema } from "../schemas";
import { LATE_RELEASE_HOURS, isPastDeadline, formatReleaseDeadline } from "../lateRelease";

export interface GrantLateReleaseState {
  error?: string;
  success?: string;
}

const ACTIVE_ENROLLMENT = ["active", "regularization", "approved"];

/**
 * Libera a avaliação para UM aluno por 24 horas depois do prazo (`closes_at`).
 * Cria a liberação ou renova a que já existe (valid_until = agora + 24 h), com motivo
 * obrigatório. Não dá tentativa extra: o limite de tentativas continua o mesmo. Auditada por gatilho.
 */
export async function grantLateRelease(
  _prevState: GrantLateReleaseState,
  formData: FormData,
): Promise<GrantLateReleaseState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "grant_exceptional_attempt" })) {
    return { error: "Você não tem permissão para liberar a prova fora do prazo." };
  }

  const parsed = grantLateReleaseSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    studentEmail: formData.get("studentEmail"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createSupabaseServerClient();

  const student = await findUserIdByEmailAndRole(supabase, parsed.data.studentEmail, "student");
  if (!student) return { error: "Nenhum aluno encontrado com esse e-mail." };

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status, closes_at, season_volume_offering_id")
    .eq("id", parsed.data.assessmentId)
    .maybeSingle();
  if (!assessment) return { error: "Avaliação não encontrada." };
  if (assessment.status !== "open") return { error: "Esta avaliação não está aberta, então não há o que liberar." };
  if (!isPastDeadline(assessment.closes_at)) {
    return { error: "O prazo desta avaliação ainda não encerrou: o aluno já pode fazer a prova normalmente." };
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", student.userId)
    .eq("season_volume_offering_id", assessment.season_volume_offering_id)
    .maybeSingle();
  if (!enrollment) return { error: "Este aluno não está matriculado na oferta desta avaliação." };
  if (!ACTIVE_ENROLLMENT.includes(enrollment.status)) {
    return { error: "A matrícula deste aluno não está ativa, então ele não conseguiria iniciar a prova." };
  }

  const validUntil = new Date(Date.now() + LATE_RELEASE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("assessment_late_releases")
    .select("id")
    .eq("assessment_id", assessment.id)
    .eq("enrollment_id", enrollment.id)
    .maybeSingle();

  // `return=representation` (select) confirma que a linha mudou de verdade: sem ele, a RLS pode recusar em silêncio.
  const { data: saved, error } = existing
    ? await supabase
        .from("assessment_late_releases")
        .update({ valid_until: validUntil, granted_by: authContext.userId, reason: parsed.data.reason, source: "staff" })
        .eq("id", existing.id)
        .select("id")
    : await supabase
        .from("assessment_late_releases")
        .insert({
          assessment_id: assessment.id,
          enrollment_id: enrollment.id,
          valid_until: validUntil,
          granted_by: authContext.userId,
          reason: parsed.data.reason,
          source: "staff",
        })
        .select("id");

  if (error || !saved || saved.length === 0) {
    return { error: "Não foi possível liberar a prova. Tente de novo." };
  }

  revalidatePath("/conteudo/avaliacoes");
  return {
    success: `${existing ? "Liberação renovada" : "Prova liberada"} para ${student.fullName} até ${formatReleaseDeadline(validUntil)}.`,
  };
}
