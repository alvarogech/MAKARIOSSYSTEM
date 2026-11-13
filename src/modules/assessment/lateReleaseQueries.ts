import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isReleaseActive } from "./lateRelease";

/**
 * Liberações ativas do aluno logado (a RLS já limita às matrículas dele), por "avaliação:matrícula".
 * Só entram as que ainda valem.
 */
export async function loadActiveLateReleases(
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
  const now = new Date();
  for (const row of data ?? []) {
    if (isReleaseActive(row.valid_until, now)) map.set(`${row.assessment_id}:${row.enrollment_id}`, row.valid_until);
  }
  return map;
}
