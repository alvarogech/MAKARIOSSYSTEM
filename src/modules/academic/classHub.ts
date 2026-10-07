import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

/** Temporada e volume de uma turma (para filtrar os carregadores de presença e de conteúdo). */
export async function classContext(supabase: DB, classId: string) {
  const { data } = await supabase
    .from("classes")
    .select("id, name, season_volume_offerings!inner(season_id, volume_id)")
    .eq("id", classId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    seasonId: data.season_volume_offerings.season_id,
    volumeId: data.season_volume_offerings.volume_id,
  };
}
