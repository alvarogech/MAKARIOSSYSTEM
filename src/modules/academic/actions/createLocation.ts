"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { assignClassLocationSchema, createLocationSchema } from "../schemas";

export interface CreateLocationState {
  error?: string;
  success?: boolean;
}

export async function createLocation(
  _prevState: CreateLocationState,
  formData: FormData,
): Promise<CreateLocationState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "locations", action: "manage" })) {
    return { error: "Você não tem permissão para cadastrar locais." };
  }

  const parsed = createLocationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    entryInstructions: formData.get("entryInstructions") || undefined,
    parkingInstructions: formData.get("parkingInstructions") || undefined,
    arrivalMinutesBefore: formData.get("arrivalMinutesBefore") || undefined,
    coordinationContact: formData.get("coordinationContact") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("locations").insert({
    name: parsed.data.name,
    address: parsed.data.address || null,
    entry_instructions: parsed.data.entryInstructions || null,
    parking_instructions: parsed.data.parkingInstructions || null,
    arrival_minutes_before: parsed.data.arrivalMinutesBefore ?? null,
    coordination_contact: parsed.data.coordinationContact || null,
  });

  if (error) {
    return { error: "Não foi possível cadastrar o local." };
  }

  revalidatePath("/coordenacao/locais");
  return { success: true };
}

export interface AssignClassLocationState {
  error?: string;
  success?: boolean;
}

export async function assignClassLocation(
  _prevState: AssignClassLocationState,
  formData: FormData,
): Promise<AssignClassLocationState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "classes", action: "manage" })) {
    return { error: "Você não tem permissão para editar turmas." };
  }

  const parsed = assignClassLocationSchema.safeParse({
    classId: formData.get("classId"),
    locationId: formData.get("locationId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("classes")
    .update({ location_id: parsed.data.locationId })
    .eq("id", parsed.data.classId);

  if (error) {
    return { error: "Não foi possível associar o local à turma." };
  }

  revalidatePath("/coordenacao/turmas");
  return { success: true };
}
