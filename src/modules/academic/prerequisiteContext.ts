import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Monta o grafo volume → pré-requisitos diretos, no formato que
 * `src/services/prerequisites.ts` (função pura) espera.
 */
export async function buildPrerequisiteGraph(
  supabase: SupabaseClient<Database>,
): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("volume_prerequisites")
    .select("volume_id, prerequisite_volume_id");

  const graph: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const list = graph[row.volume_id] ?? [];
    list.push(row.prerequisite_volume_id);
    graph[row.volume_id] = list;
  }
  return graph;
}

/** Volumes que o aluno já concluiu (matrícula com status = 'approved'), em qualquer temporada. */
export async function getApprovedVolumeIds(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<Set<string>> {
  const { data: approvedEnrollments } = await supabase
    .from("enrollments")
    .select("season_volume_offering_id")
    .eq("student_id", studentId)
    .eq("status", "approved");

  if (!approvedEnrollments || approvedEnrollments.length === 0) {
    return new Set();
  }

  const offeringIds = approvedEnrollments.map(
    (row) => row.season_volume_offering_id,
  );

  const { data: offerings } = await supabase
    .from("season_volume_offerings")
    .select("id, volume_id")
    .in("id", offeringIds);

  return new Set((offerings ?? []).map((row) => row.volume_id));
}

/** Pré-requisitos especificamente perdoados por exceção para este aluno+volume alvo. */
export async function getExceptionVolumeIds(
  supabase: SupabaseClient<Database>,
  studentId: string,
  targetVolumeId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("prerequisite_exceptions")
    .select("missing_prerequisite_volume_id")
    .eq("student_id", studentId)
    .eq("volume_id", targetVolumeId);

  return new Set((data ?? []).map((row) => row.missing_prerequisite_volume_id));
}
