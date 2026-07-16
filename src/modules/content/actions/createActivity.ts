"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createActivitySchema } from "../schemas";

export interface CreateActivityState {
  error?: string;
  success?: boolean;
}

export async function createActivity(
  _prevState: CreateActivityState,
  formData: FormData,
): Promise<CreateActivityState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "activities", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar exercícios." };
  }

  const parsed = createActivitySchema.safeParse({
    lessonId: formData.get("lessonId"),
    title: formData.get("title"),
    instructions: formData.get("instructions") || undefined,
    maxAttempts: formData.get("maxAttempts") || undefined,
    blocksProgress: formData.get("blocksProgress") === "on",
    showFeedbackAfterSubmit: formData.get("showFeedbackAfterSubmit") !== "off",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("activities").insert({
    lesson_id: parsed.data.lessonId,
    title: parsed.data.title,
    instructions: parsed.data.instructions ?? null,
    max_attempts: parsed.data.maxAttempts ?? null,
    blocks_progress: parsed.data.blocksProgress ?? false,
    show_feedback_after_submit: parsed.data.showFeedbackAfterSubmit ?? true,
    status: "published",
  });

  if (error) {
    return { error: "Não foi possível criar o exercício." };
  }

  revalidatePath("/conteudo/questoes");
  return { success: true };
}
