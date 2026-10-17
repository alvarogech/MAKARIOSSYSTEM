import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

export type CreditRowWithKey = Database["public"]["Functions"]["attendance_credits"]["Returns"][number];

/** Teto de linhas por resposta da API do Supabase (max_rows). Acima disso ela corta calada. */
const PAGE_SIZE = 1000;

/**
 * Todas as presenças (QR, manual, reposição e autodeclaração) que a sessão pode ver, em páginas.
 * Uma chamada só de attendance_credits() devolvia no máximo mil linhas e cortava o resto sem
 * avisar: em 17/10/2026 a temporada passou de mil e os lançamentos mais novos sumiram da ficha
 * do aluno e da Visão geral. `personKeys` filtra no banco (ficha de um aluno).
 */
export async function loadAttendanceCredits(
  supabase: DB,
  options: { classId?: string; personKeys?: string[] } = {},
): Promise<CreditRowWithKey[]> {
  const rows: CreditRowWithKey[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.rpc("attendance_credits", options.classId ? { p_class_id: options.classId } : {});
    if (options.personKeys) query = query.in("person_key", options.personKeys);
    // Ordem total e estável, senão a mesma linha pode cair em duas páginas (ou em nenhuma).
    const { data, error } = await query
      .order("person_key")
      .order("meeting_id")
      .order("counts_for_meeting_id")
      .order("source")
      .order("minutes")
      .order("lessons")
      .order("location_status")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Não foi possível carregar as presenças: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
