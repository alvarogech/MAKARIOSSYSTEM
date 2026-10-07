import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addSaoPauloDays, getSaoPauloDateKey } from "@/lib/saoPauloDate";

type DB = SupabaseClient<Database>;

export interface PendingReport {
  classId: string;
  meetingId: string;
  className: string;
  sequence: number;
  date: string;
}

/** Encontros dos últimos 21 dias em que o professor deu aula e ainda não enviou o relatório pós-aula. */
export async function loadPendingReports(supabase: DB, teacherId: string): Promise<PendingReport[]> {
  const today = getSaoPauloDateKey(new Date());
  const from = getSaoPauloDateKey(addSaoPauloDays(new Date(), -21));

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
      .select("id, class_id, sequence, meeting_date, classes!inner(name)")
      .in("id", meetingIds)
      .gte("meeting_date", from)
      .lt("meeting_date", today)
      .neq("status", "canceled")
      .order("meeting_date", { ascending: false }),
    supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", teacherId).in("meeting_id", meetingIds),
  ]);

  const done = new Set((reports ?? []).map((r) => r.meeting_id));
  return (meetings ?? [])
    .filter((m) => m.meeting_date && !done.has(m.id))
    .map((m) => ({
      classId: m.class_id,
      meetingId: m.id,
      className: m.classes.name,
      sequence: m.sequence,
      date: m.meeting_date!,
    }));
}
