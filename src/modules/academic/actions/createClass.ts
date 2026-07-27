"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createClassSchema } from "../schemas";

export interface CreateClassState {
  error?: string;
  success?: boolean;
}

/**
 * Cria a turma e já gera todos os seus encontros (a partir do modelo de
 * horário) numa única transação, via a função de banco
 * `create_class_with_meetings` — ver supabase/migrations/
 * 00000000000019_create_class_with_meetings.sql.
 */
export async function createClass(
  _prevState: CreateClassState,
  formData: FormData,
): Promise<CreateClassState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "classes", action: "manage" })) {
    return { error: "Você não tem permissão para criar turmas." };
  }

  const parsed = createClassSchema.safeParse({
    seasonVolumeOfferingId: formData.get("seasonVolumeOfferingId"),
    classTemplateId: formData.get("classTemplateId"),
    name: formData.get("name"),
    location: formData.get("location") || undefined,
    capacity: formData.get("capacity") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_class_with_meetings", {
    p_season_volume_offering_id: parsed.data.seasonVolumeOfferingId,
    p_class_template_id: parsed.data.classTemplateId,
    p_name: parsed.data.name,
    p_location: parsed.data.location ?? undefined,
    p_capacity: parsed.data.capacity ?? undefined,
  });

  if (error) {
    return { error: "Não foi possível criar a turma." };
  }

  revalidatePath("/coordenacao/turmas");
  return { success: true };
}
