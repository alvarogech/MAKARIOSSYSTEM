"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { publishContentSchema } from "../schemas";

export interface PublishContentState {
  error?: string;
  success?: boolean;
}

export async function publishContent(
  _prevState: PublishContentState,
  formData: FormData,
): Promise<PublishContentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "content", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar conteúdo." };
  }

  const parsed = publishContentSchema.safeParse({
    contentId: formData.get("contentId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("contents")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.contentId);

  if (error) {
    return { error: "Não foi possível atualizar o status do conteúdo." };
  }

  revalidatePath("/conteudo");
  return { success: true };
}
