"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { weekStartOf } from "../rules";

export interface SimpleState {
  error?: string;
  success?: boolean;
}

/** Cria o QR Code da semana para cada volume que ainda não tem. */
export async function generateWeekQrCodes(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) {
    return { error: "Você não tem permissão para gerar os QR Codes." };
  }
  const week = String(formData.get("week") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || weekStartOf(week) !== week) return { error: "Semana inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: volumes } = await supabase.from("volumes").select("id");
  const rows = (volumes ?? []).map((v) => ({
    volume_id: v.id,
    week_start: week,
    token: randomBytes(16).toString("base64url"),
    created_by: auth.userId,
  }));
  const { error } = await supabase
    .from("attendance_qr_codes")
    .upsert(rows, { onConflict: "volume_id,week_start", ignoreDuplicates: true });
  if (error) return { error: "Não foi possível gerar os QR Codes." };

  revalidatePath("/coordenacao/presenca");
  return { success: true };
}

/** Coordenadas de um local, usadas na checagem de localização da chamada. */
export async function updateLocationCoordinates(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "locations", action: "manage" })) {
    return { error: "Você não tem permissão para editar locais." };
  }
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("coordinates") ?? "").trim();
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (raw) {
    const parts = raw.split(",").map((p) => Number(p.trim()));
    const [lat, lng] = parts;
    if (parts.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) {
      return { error: "Cole as coordenadas no formato do Google Maps, por exemplo: -16.6973877, -49.2767771" };
    }
    latitude = lat!;
    longitude = lng!;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ latitude, longitude })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível salvar as coordenadas." };

  revalidatePath("/coordenacao/locais");
  return { success: true };
}
