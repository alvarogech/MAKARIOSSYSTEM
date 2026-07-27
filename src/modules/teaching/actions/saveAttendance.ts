"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { resolveRecognizedMinutes } from "@/services/attendance";
import { saveAttendanceSchema } from "../schemas";

export interface SaveAttendanceState {
  error?: string;
  success?: boolean;
  rowErrors?: { enrollmentId: string; message: string }[];
}

/**
 * Salva a frequência de um encontro, linha a linha, via a função
 * `save_attendance_row` (uma transação por linha, com a justificativa
 * propagada corretamente para o trigger de histórico quando é uma
 * correção). RLS decide, por linha, se o professor ainda pode escrever
 * (rascunho) ou se já foi finalizada.
 */
export async function saveAttendance(
  _prevState: SaveAttendanceState,
  formData: FormData,
): Promise<SaveAttendanceState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "attendance", action: "record" })) {
    return { error: "Você não tem permissão para registrar frequência." };
  }

  let rawRows: unknown;
  try {
    rawRows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Dados de frequência inválidos." };
  }

  const parsed = saveAttendanceSchema.safeParse({
    meetingId: formData.get("meetingId"),
    rows: rawRows,
    justification: formData.get("justification") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: meeting } = await supabase
    .from("class_meetings")
    .select("id, academic_minutes")
    .eq("id", parsed.data.meetingId)
    .maybeSingle();

  if (!meeting) {
    return { error: "Encontro não encontrado." };
  }

  const rowErrors: { enrollmentId: string; message: string }[] = [];

  await Promise.all(
    parsed.data.rows.map(async (row) => {
      const recognizedMinutes = resolveRecognizedMinutes(
        row.status,
        meeting.academic_minutes,
        row.recognizedMinutes,
      );

      const { error } = await supabase.rpc("save_attendance_row", {
        p_meeting_id: parsed.data.meetingId,
        p_enrollment_id: row.enrollmentId,
        p_status: row.status,
        p_recognized_minutes: recognizedMinutes,
        p_observation: row.observation ?? undefined,
        p_justification: parsed.data.justification ?? undefined,
      });

      if (error) {
        rowErrors.push({
          enrollmentId: row.enrollmentId,
          message: "Não foi possível salvar (talvez a frequência já esteja finalizada).",
        });
      }
    }),
  );

  revalidatePath(`/professor/turmas`);

  if (rowErrors.length > 0) {
    return {
      error: `${rowErrors.length} de ${parsed.data.rows.length} registro(s) não puderam ser salvos.`,
      rowErrors,
    };
  }

  return { success: true };
}
