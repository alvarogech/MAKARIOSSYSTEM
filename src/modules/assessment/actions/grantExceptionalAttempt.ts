"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { findUserIdByEmailAndRole } from "@/modules/academic/lookupUser";
import { grantExceptionalAttemptSchema } from "../schemas";

export interface GrantExceptionalAttemptState {
  error?: string;
  success?: boolean;
}

/**
 * Concede uma tentativa excepcional — sempre manual e justificada (doc
 * 02 §8/§15), auditada via trigger em assessment_exceptional_grants.
 */
export async function grantExceptionalAttempt(
  _prevState: GrantExceptionalAttemptState,
  formData: FormData,
): Promise<GrantExceptionalAttemptState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "assessments", action: "grant_exceptional_attempt" })
  ) {
    return { error: "Você não tem permissão para conceder tentativa excepcional." };
  }

  const parsed = grantExceptionalAttemptSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    studentEmail: formData.get("studentEmail"),
    justification: formData.get("justification"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const student = await findUserIdByEmailAndRole(supabase, parsed.data.studentEmail, "student");
  if (!student) {
    return { error: "Nenhum aluno encontrado com esse e-mail." };
  }

  const { data: assessment } = await supabase
    .from("assessments")
    .select("season_volume_offering_id")
    .eq("id", parsed.data.assessmentId)
    .maybeSingle();

  if (!assessment) {
    return { error: "Avaliação não encontrada." };
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", student.userId)
    .eq("season_volume_offering_id", assessment.season_volume_offering_id)
    .maybeSingle();

  if (!enrollment) {
    return { error: "Este aluno não está matriculado na oferta desta avaliação." };
  }

  const { error } = await supabase.from("assessment_exceptional_grants").insert({
    assessment_id: parsed.data.assessmentId,
    enrollment_id: enrollment.id,
    granted_by: authContext.userId,
    justification: parsed.data.justification,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Este aluno já tem uma tentativa excepcional concedida para esta avaliação."
        : "Não foi possível conceder a tentativa excepcional.",
    };
  }

  revalidatePath("/conteudo/avaliacoes");
  return { success: true };
}
