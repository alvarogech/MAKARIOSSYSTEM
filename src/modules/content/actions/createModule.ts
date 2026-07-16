"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createModuleSchema } from "../schemas";

export interface CreateModuleState {
  error?: string;
  success?: boolean;
}

export async function createModule(
  _prevState: CreateModuleState,
  formData: FormData,
): Promise<CreateModuleState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "content", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar conteúdo." };
  }

  const parsed = createModuleSchema.safeParse({
    volumeId: formData.get("volumeId"),
    name: formData.get("name"),
    orderIndex: formData.get("orderIndex"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("modules").insert({
    volume_id: parsed.data.volumeId,
    name: parsed.data.name,
    order_index: parsed.data.orderIndex,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Já existe um módulo com essa posição neste volume."
        : "Não foi possível criar o módulo.",
    };
  }

  revalidatePath("/conteudo");
  return { success: true };
}
