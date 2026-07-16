"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { attachQuestionSchema } from "../schemas";

export interface AttachQuestionState {
  error?: string;
  success?: boolean;
}

export async function attachQuestion(
  _prevState: AttachQuestionState,
  formData: FormData,
): Promise<AttachQuestionState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "activities", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar exercícios." };
  }

  const parsed = attachQuestionSchema.safeParse({
    activityId: formData.get("activityId"),
    questionId: formData.get("questionId"),
    orderIndex: formData.get("orderIndex"),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("activity_questions").insert({
    activity_id: parsed.data.activityId,
    question_id: parsed.data.questionId,
    order_index: parsed.data.orderIndex,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Esta questão já está neste exercício."
        : "Não foi possível vincular a questão.",
    };
  }

  revalidatePath("/conteudo/questoes");
  return { success: true };
}
