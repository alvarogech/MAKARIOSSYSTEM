import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ImportLookupTables } from "@/services/studentImport";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Carrega oferta/turma do banco uma única vez e devolve as funções de
 * consulta que `validateStudentImportRow` (função pura) espera — evita
 * uma query por linha da planilha.
 */
export async function buildImportLookupTables(
  supabase: SupabaseClient<Database>,
): Promise<ImportLookupTables> {
  const [{ data: offerings }, { data: volumes }, { data: seasons }, { data: classes }] =
    await Promise.all([
      supabase.from("season_volume_offerings").select("id, season_id, volume_id"),
      supabase.from("volumes").select("id, name"),
      supabase.from("seasons").select("id, name"),
      supabase.from("classes").select("id, name, season_volume_offering_id"),
    ]);

  const volumeNameById = new Map((volumes ?? []).map((v) => [v.id, v.name]));
  const seasonNameById = new Map((seasons ?? []).map((s) => [s.id, s.name]));

  const offeringByKey = new Map<string, { offeringId: string }>();
  for (const offering of offerings ?? []) {
    const volumeName = volumeNameById.get(offering.volume_id);
    const seasonName = seasonNameById.get(offering.season_id);
    if (!volumeName || !seasonName) continue;
    offeringByKey.set(`${normalize(volumeName)}::${normalize(seasonName)}`, {
      offeringId: offering.id,
    });
  }

  const classByKey = new Map<string, { classId: string }>();
  for (const klass of classes ?? []) {
    classByKey.set(
      `${klass.season_volume_offering_id}::${normalize(klass.name)}`,
      { classId: klass.id },
    );
  }

  return {
    findOffering(volumeName, seasonName) {
      return (
        offeringByKey.get(`${normalize(volumeName)}::${normalize(seasonName)}`) ??
        null
      );
    },
    findClass(offeringId, className) {
      return classByKey.get(`${offeringId}::${normalize(className)}`) ?? null;
    },
  };
}
