"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export interface SimpleState {
  error?: string;
  success?: boolean;
}

/** Cria o QR Code permanente de cada volume que ainda não tem. */
export async function generateQrCodes(_prev: SimpleState): Promise<SimpleState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) {
    return { error: "Você não tem permissão para gerar os QR Codes." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: volumes } = await supabase.from("volumes").select("id");
  const rows = (volumes ?? []).map((v) => ({
    volume_id: v.id,
    token: randomBytes(16).toString("base64url"),
    created_by: auth.userId,
  }));
  const { error } = await supabase
    .from("attendance_qr_codes")
    .upsert(rows, { onConflict: "volume_id", ignoreDuplicates: true });
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

/** Liga ou desliga a obrigação de localização na chamada. */
export async function setRequireLocation(requireLocation: boolean): Promise<SimpleState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) {
    return { error: "Você não tem permissão para mudar esta configuração." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance_settings")
    .update({ require_location: requireLocation, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível salvar. Confira se a atualização do banco (060) foi aplicada." };
  revalidatePath("/coordenacao/presenca");
  return { success: true };
}

/**
 * Presença lançada à mão (lista de papel): substitui o lançamento anterior
 * da mesma pessoa no mesmo encontro.
 */
export async function addManualAttendance(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) {
    return { error: "Você não tem permissão para lançar presença." };
  }
  const person = String(formData.get("person") ?? "");
  const meetingId = String(formData.get("meeting") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const lessons = [...new Set(formData.getAll("lessons").map((v) => Number(v)))].filter((n) => Number.isInteger(n) && n > 0);
  const match = /^(r|s):([0-9a-f-]{36})$/.exec(person);
  if (!match) return { error: "Escolha o aluno." };
  if (!meetingId) return { error: "Escolha o encontro." };
  if (lessons.length === 0) return { error: "Marque pelo menos uma aula." };

  const supabase = await createSupabaseServerClient();
  const { data: meeting } = await supabase.from("class_meetings").select("academic_minutes").eq("id", meetingId).maybeSingle();
  if (!meeting) return { error: "Encontro não encontrado." };
  const maxLesson = Math.round(meeting.academic_minutes / 30);
  if (lessons.some((n) => n > maxLesson)) return { error: "Aula fora do encontro." };

  const who = match[1] === "r" ? { enrollment_request_id: match[2]!, student_id: null } : { enrollment_request_id: null, student_id: match[2]! };
  const existing = supabase.from("attendance_manual_entries").delete().eq("meeting_id", meetingId);
  await (who.enrollment_request_id
    ? existing.eq("enrollment_request_id", who.enrollment_request_id)
    : existing.eq("student_id", who.student_id!).is("enrollment_request_id", null));

  const { data, error } = await supabase
    .from("attendance_manual_entries")
    .insert({ meeting_id: meetingId, ...who, lessons: lessons.sort((a, b) => a - b), note, created_by: auth.userId })
    .select("id");
  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Confira se a atualização do banco (061) foi aplicada." };
  }
  revalidatePath("/coordenacao/presenca");
  return { success: true };
}

export async function deleteManualAttendance(formData: FormData): Promise<void> {
  const auth = await getAuthContext();
  if (!auth || !can(auth, { resource: "attendance", action: "correct" })) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("attendance_manual_entries").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/coordenacao/presenca");
}
