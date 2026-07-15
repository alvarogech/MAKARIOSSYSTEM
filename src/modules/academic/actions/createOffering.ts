"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createOfferingSchema } from "../schemas";

export interface CreateOfferingState {
  error?: string;
  success?: boolean;
}

export async function createOffering(
  _prevState: CreateOfferingState,
  formData: FormData,
): Promise<CreateOfferingState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "offerings", action: "manage" })) {
    return { error: "Você não tem permissão para criar ofertas de volume." };
  }

  const parsed = createOfferingSchema.safeParse({
    seasonId: formData.get("seasonId"),
    volumeId: formData.get("volumeId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("season_volume_offerings").insert({
    season_id: parsed.data.seasonId,
    volume_id: parsed.data.volumeId,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Este volume já tem uma oferta nesta temporada."
        : "Não foi possível criar a oferta.",
    };
  }

  revalidatePath("/coordenacao/temporadas");
  return { success: true };
}
