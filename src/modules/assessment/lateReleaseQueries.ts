import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isReleaseActive } from "./lateRelease";

/**
 * Liberações do aluno logado (a RLS já limita às matrículas dele), por "avaliação:matrícula",
 * com `valid_until` mesmo quando já venceram (a tela precisa dizer "o prazo de 24 horas terminou").
 */
export async function loadLateReleases(
  supabase: SupabaseClient<Database>,
  enrollmentIds: string[],
  assessmentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (enrollmentIds.length === 0 || assessmentIds.length === 0) return map;
  const { data } = await supabase
    .from("assessment_late_releases")
    .select("assessment_id, enrollment_id, valid_until")
    .in("enrollment_id", enrollmentIds)
    .in("assessment_id", assessmentIds);
  for (const row of data ?? []) map.set(`${row.assessment_id}:${row.enrollment_id}`, row.valid_until);
  return map;
}

/** Só as liberações que ainda valem. */
export async function loadActiveLateReleases(
  supabase: SupabaseClient<Database>,
  enrollmentIds: string[],
  assessmentIds: string[],
): Promise<Map<string, string>> {
  const all = await loadLateReleases(supabase, enrollmentIds, assessmentIds);
  const now = new Date();
  return new Map([...all].filter(([, validUntil]) => isReleaseActive(validUntil, now)));
}

/** Quantas tentativas (de qualquer status) o aluno logado já tem, por "avaliação:matrícula". */
export async function loadAttemptCounts(
  supabase: SupabaseClient<Database>,
  enrollmentIds: string[],
  assessmentIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (enrollmentIds.length === 0 || assessmentIds.length === 0) return map;
  const { data } = await supabase
    .from("assessment_attempts")
    .select("assessment_id, enrollment_id")
    .in("enrollment_id", enrollmentIds)
    .in("assessment_id", assessmentIds);
  for (const row of data ?? []) {
    const key = `${row.assessment_id}:${row.enrollment_id}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
