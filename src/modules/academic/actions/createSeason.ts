"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createSeasonSchema } from "../schemas";

export interface CreateSeasonState {
  error?: string;
  success?: boolean;
}

export async function createSeason(
  _prevState: CreateSeasonState,
  formData: FormData,
): Promise<CreateSeasonState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "seasons", action: "manage" })) {
    return { error: "Você não tem permissão para criar temporadas." };
  }

  const parsed = createSeasonSchema.safeParse({
    name: formData.get("name"),
    startsOn: formData.get("startsOn") || undefined,
    endsOn: formData.get("endsOn") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("seasons").insert({
    name: parsed.data.name,
    starts_on: parsed.data.startsOn || null,
    ends_on: parsed.data.endsOn || null,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Já existe uma temporada com esse nome."
        : "Não foi possível criar a temporada.",
    };
  }

  revalidatePath("/coordenacao/temporadas");
  return { success: true };
}
