"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createLessonSchema } from "../schemas";

export interface CreateLessonState {
  error?: string;
  success?: boolean;
}

export async function createLesson(
  _prevState: CreateLessonState,
  formData: FormData,
): Promise<CreateLessonState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "content", action: "manage" })) {
    return { error: "Você não tem permissão para gerenciar conteúdo." };
  }

  const parsed = createLessonSchema.safeParse({
    moduleId: formData.get("moduleId"),
    name: formData.get("name"),
    objectives: formData.get("objectives") || undefined,
    orderIndex: formData.get("orderIndex"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("lessons").insert({
    module_id: parsed.data.moduleId,
    name: parsed.data.name,
    objectives: parsed.data.objectives ?? null,
    order_index: parsed.data.orderIndex,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Já existe uma aula com essa posição neste módulo."
        : "Não foi possível criar a aula.",
    };
  }

  revalidatePath("/conteudo");
  return { success: true };
}
