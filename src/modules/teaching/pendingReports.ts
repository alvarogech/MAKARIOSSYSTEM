import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addSaoPauloDays, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { isMeetingOver } from "./reportSettings";
import { loadReportActiveByClass } from "./reportSettingsLoader";

type DB = SupabaseClient<Database>;

export interface PendingReport {
  classId: string;
  meetingId: string;
  className: string;
  sequence: number;
  date: string;
}

/**
 * Encontros dos últimos 21 dias em que o professor ESTAVA ESCALADO, que já terminaram e ainda sem relatório.
 * Semestre com o relatório desligado não gera nenhuma pendência.
 */
export async function loadPendingReports(supabase: DB, teacherId: string): Promise<PendingReport[]> {
  const now = new Date();
  const today = getSaoPauloDateKey(now);
  const from = getSaoPauloDateKey(addSaoPauloDays(now, -21));

  const { data: myBlocks } = await supabase
    .from("class_meeting_blocks")
    .select("class_meeting_id")
    .eq("teacher_id", teacherId)
    .neq("status", "canceled");
  const meetingIds = [...new Set((myBlocks ?? []).map((b) => b.class_meeting_id))];
  if (meetingIds.length === 0) return [];

  const [{ data: meetings }, { data: reports }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select("id, class_id, sequence, meeting_date, end_time, classes!inner(name)")
      .in("id", meetingIds)
      .gte("meeting_date", from)
      .lte("meeting_date", today)
      .neq("status", "canceled")
      .order("meeting_date", { ascending: false }),
    supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", teacherId).in("meeting_id", meetingIds),
  ]);

  const activeByClass = await loadReportActiveByClass(supabase, [...new Set((meetings ?? []).map((m) => m.class_id))]);
  const done = new Set((reports ?? []).map((r) => r.meeting_id));
  return (meetings ?? [])
    .filter((m) => m.meeting_date && !done.has(m.id) && activeByClass.get(m.class_id) && isMeetingOver(m.meeting_date, m.end_time, now))
    .map((m) => ({
      classId: m.class_id,
      meetingId: m.id,
      className: m.classes.name,
      sequence: m.sequence,
      date: m.meeting_date!,
    }));
}
