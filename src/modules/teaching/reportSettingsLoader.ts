import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isMeetingOver, isRelatorioAtivo, reportState, type ReportState } from "./reportSettings";

type DB = SupabaseClient<Database>;

/** Para cada turma, o semestre dela exige o relatório? */
export async function loadReportActiveByClass(supabase: DB, classIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (classIds.length === 0) return result;

  const { data: classes } = await supabase.from("classes").select("id, season_volume_offering_id").in("id", classIds);
  const offeringIds = [...new Set((classes ?? []).map((c) => c.season_volume_offering_id))];
  const { data: offerings } = offeringIds.length
    ? await supabase.from("season_volume_offerings").select("id, season_id").in("id", offeringIds)
    : { data: [] as { id: string; season_id: string }[] };
  const seasonIds = [...new Set((offerings ?? []).map((o) => o.season_id))];
  const { data: seasons } = seasonIds.length
    ? await supabase.from("seasons").select("id, require_class_report").in("id", seasonIds)
    : { data: [] as { id: string; require_class_report: boolean }[] };

  const seasonById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const seasonByOffering = new Map((offerings ?? []).map((o) => [o.id, o.season_id]));
  for (const klass of classes ?? []) {
    const seasonId = seasonByOffering.get(klass.season_volume_offering_id);
    result.set(klass.id, isRelatorioAtivo(seasonId ? seasonById.get(seasonId) : null));
  }
  return result;
}

export interface ReportEligibility {
  state: ReportState;
  meeting: { id: string; classId: string; sequence: number; date: string | null; endTime: string | null } | null;
}

/** Estado do relatório de um professor em um encontro: desligado, não escalado, ainda não terminou ou aberto. */
export async function loadReportEligibility(supabase: DB, meetingId: string, teacherId: string, now = new Date()): Promise<ReportEligibility> {
  const { data: meeting } = await supabase
    .from("class_meetings")
    .select("id, class_id, sequence, meeting_date, end_time")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) return { state: "inactive", meeting: null };

  const [active, { data: blocks }] = await Promise.all([
    loadReportActiveByClass(supabase, [meeting.class_id]),
    supabase.from("class_meeting_blocks").select("id").eq("class_meeting_id", meetingId).eq("teacher_id", teacherId).neq("status", "canceled").limit(1),
  ]);

  return {
    state: reportState({
      active: active.get(meeting.class_id) ?? false,
      scheduled: (blocks ?? []).length > 0,
      over: isMeetingOver(meeting.meeting_date, meeting.end_time, now),
    }),
    meeting: { id: meeting.id, classId: meeting.class_id, sequence: meeting.sequence, date: meeting.meeting_date, endTime: meeting.end_time },
  };
}
