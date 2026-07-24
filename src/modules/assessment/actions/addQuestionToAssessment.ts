"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { addQuestionToAssessmentSchema } from "../schemas";

export interface AddQuestionToAssessmentState {
  error?: string;
  success?: boolean;
}

/**
 * Vincula uma questão do banco à avaliação. Se a avaliação for do tipo
 * "recovery" e a questão já estiver na avaliação regular vinculada, o
 * INSERT falha por causa do trigger `enforce_recovery_questions_disjoint`
 * (doc 05 §12) — o erro é repassado de forma legível.
 */
export async function addQuestionToAssessment(
  _prevState: AddQuestionToAssessmentState,
  formData: FormData,
): Promise<AddQuestionToAssessmentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar avaliações." };
  }

  const parsed = addQuestionToAssessmentSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    questionId: formData.get("questionId"),
    points: formData.get("points"),
    orderIndex: formData.get("orderIndex"),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assessment_questions").insert({
    assessment_id: parsed.data.assessmentId,
    question_id: parsed.data.questionId,
    points: parsed.data.points,
    order_index: parsed.data.orderIndex,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Esta questão já está nesta avaliação." };
    }
    return {
      error: error.message.includes("questões diferentes")
        ? error.message
        : "Não foi possível adicionar a questão (verifique se ela já está na avaliação regular vinculada).",
    };
  }

  revalidatePath("/conteudo/avaliacoes");
  return { success: true };
}
