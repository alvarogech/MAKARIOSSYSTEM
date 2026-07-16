"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createReleaseRuleSchema } from "../schemas";

export interface CreateReleaseRuleState {
  error?: string;
  success?: boolean;
}

export async function createReleaseRule(
  _prevState: CreateReleaseRuleState,
  formData: FormData,
): Promise<CreateReleaseRuleState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "release_rules", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar regras de liberação." };
  }

  const parsed = createReleaseRuleSchema.safeParse({
    contentId: formData.get("contentId"),
    type: formData.get("type"),
    releaseAt: formData.get("releaseAt") || undefined,
    requiredContentId: formData.get("requiredContentId") || undefined,
    requiredActivityId: formData.get("requiredActivityId") || undefined,
    requiredMeetingId: formData.get("requiredMeetingId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("release_rules").insert({
    content_id: parsed.data.contentId,
    type: parsed.data.type,
    release_at: parsed.data.releaseAt ? new Date(parsed.data.releaseAt).toISOString() : null,
    required_content_id: parsed.data.requiredContentId || null,
    required_activity_id: parsed.data.requiredActivityId || null,
    required_meeting_id: parsed.data.requiredMeetingId || null,
  });

  if (error) {
    return { error: "Não foi possível criar a regra de liberação." };
  }

  revalidatePath("/conteudo");
  return { success: true };
}
