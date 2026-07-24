"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { addRecoveryPathItemSchema } from "../schemas";

export interface AddRecoveryPathItemState {
  error?: string;
  success?: boolean;
}

export async function addRecoveryPathItem(
  _prevState: AddRecoveryPathItemState,
  formData: FormData,
): Promise<AddRecoveryPathItemState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar avaliações." };
  }

  const parsed = addRecoveryPathItemSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    contentId: formData.get("contentId") || undefined,
    activityId: formData.get("activityId") || undefined,
    orderIndex: formData.get("orderIndex"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("recovery_path_items").insert({
    assessment_id: parsed.data.assessmentId,
    content_id: parsed.data.contentId || null,
    activity_id: parsed.data.activityId || null,
    order_index: parsed.data.orderIndex,
  });

  if (error) {
    return { error: "Não foi possível adicionar o item à trilha de revisão." };
  }

  revalidatePath("/conteudo/avaliacoes");
  return { success: true };
}
