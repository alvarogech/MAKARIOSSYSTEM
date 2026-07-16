/**
 * Cálculo de frequência (doc 02 §9). Funções puras — sem Postgres/Supabase.
 *
 * `calculateAttendancePercent` implementa só a parte que já existe nesta
 * fase (soma de minutos reconhecidos em `attendance_records` dividida
 * pela carga total do volume). A fórmula completa do PLANO_TECNICO.md
 * seção 14 — que soma também os créditos de reposição validados — só
 * fecha na Fase 6, quando `attendance_makeup_credits` existir.
 */

import type { AttendanceStatus } from "@/integrations/supabase/types";

const ZERO_MINUTES_STATUSES: readonly AttendanceStatus[] = [
  "ausente",
  "falta_justificada",
  "pendente",
  "reposicao",
];

/**
 * Resolve quantos minutos reconhecer para um registro de presença.
 * - "presente": os minutos acadêmicos inteiros do encontro.
 * - "ausente" / "falta_justificada" / "pendente" / "reposicao": zero
 *   (reposição só passa a contar via crédito separado, na Fase 6).
 * - "atrasado" / "presenca_parcial": o valor informado por quem registrou,
 *   limitado entre 0 e os minutos do encontro (doc 02 §9.8).
 */
export function resolveRecognizedMinutes(
  status: AttendanceStatus,
  meetingAcademicMinutes: number,
  providedMinutes?: number | null,
): number {
  if (status === "presente") {
    return meetingAcademicMinutes;
  }

  if (ZERO_MINUTES_STATUSES.includes(status)) {
    return 0;
  }

  // "atrasado" | "presenca_parcial"
  const value = providedMinutes ?? 0;
  return Math.min(Math.max(value, 0), meetingAcademicMinutes);
}

/**
 * Percentual de frequência = minutos reconhecidos / carga total do
 * volume (960 min = 16h, por padrão — doc 02 §9.1/§9.2).
 */
export function calculateAttendancePercent(
  recognizedMinutesSum: number,
  totalVolumeMinutes: number,
): number {
  if (totalVolumeMinutes <= 0) {
    return 0;
  }

  const percent = (recognizedMinutesSum / totalVolumeMinutes) * 100;
  return Math.round(Math.min(100, Math.max(0, percent)) * 100) / 100;
}

/** Mínimo padrão de 75% (doc 02 §9.2). */
export function isAttendanceSufficient(
  percent: number,
  minimumPercent = 75,
): boolean {
  return percent >= minimumPercent;
}
