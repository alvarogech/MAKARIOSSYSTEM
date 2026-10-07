import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSaoPauloDateKey, addSaoPauloDays } from "@/lib/saoPauloDate";
import { loadReportActiveByClass } from "@/modules/teaching/reportSettingsLoader";

type DB = SupabaseClient<Database>;

export interface MeetingWithoutTeacher {
  meetingId: string;
  classId: string;
  className: string;
  sequence: number;
  date: string;
  past: boolean;
}

export interface CoordinationAlerts {
  withoutTeacher: MeetingWithoutTeacher[];
  reportsMissing: number;
  dataIssues: number;
}

/** O que a coordenação precisa resolver agora: aulas sem professor (últimas e próximas semanas), relatórios e dados duplicados. */
export async function loadCoordinationAlerts(supabase: DB): Promise<CoordinationAlerts> {
  const today = getSaoPauloDateKey(new Date());
  const from = getSaoPauloDateKey(addSaoPauloDays(new Date(), -14));
  const to = getSaoPauloDateKey(addSaoPauloDays(new Date(), 14));

  const { data: meetings } = await supabase
    .from("class_meetings")
    .select("id, class_id, sequence, meeting_date, classes!inner(name)")
    .gte("meeting_date", from)
    .lte("meeting_date", to)
    .neq("status", "canceled")
    .order("meeting_date");

  const ids = (meetings ?? []).map((m) => m.id);
  const [{ data: blocks }, { data: reports }, { data: quality }] = await Promise.all([
    ids.length
      ? supabase.from("class_meeting_blocks").select("class_meeting_id, teacher_id, teacher_label, status").in("class_meeting_id", ids)
      : Promise.resolve({ data: [] as { class_meeting_id: string; teacher_id: string | null; teacher_label: string | null; status: string }[] }),
    ids.length
      ? supabase.from("class_meeting_reports").select("meeting_id").in("meeting_id", ids)
      : Promise.resolve({ data: [] as { meeting_id: string }[] }),
    supabase.rpc("data_quality_report"),
  ]);

  // Semestre com o relatório desligado não gera pendência nenhuma.
  const reportActiveByClass = await loadReportActiveByClass(supabase, [...new Set((meetings ?? []).map((m) => m.class_id))]);
  const withTeacher = new Set((blocks ?? []).filter((b) => b.teacher_id && b.status !== "canceled").map((b) => b.class_meeting_id));
  // Professor sem conta (só o nome na escala) conta como escalado, mas não pode enviar relatório.
  const scheduled = new Set((blocks ?? []).filter((b) => (b.teacher_id || b.teacher_label) && b.status !== "canceled").map((b) => b.class_meeting_id));
  const reported = new Set((reports ?? []).map((r) => r.meeting_id));

  const withoutTeacher: MeetingWithoutTeacher[] = (meetings ?? [])
    .filter((m) => m.meeting_date && !scheduled.has(m.id))
    .map((m) => ({
      meetingId: m.id,
      classId: m.class_id,
      className: m.classes.name,
      sequence: m.sequence,
      date: m.meeting_date!,
      past: m.meeting_date! < today,
    }));

  const reportsMissing = (meetings ?? []).filter(
    (m) => m.meeting_date && m.meeting_date < today && reportActiveByClass.get(m.class_id) && withTeacher.has(m.id) && !reported.has(m.id),
  ).length;

  const q = (quality ?? {}) as {
    duplicate_profiles?: unknown[];
    duplicate_teacher_invites?: unknown[];
    teacher_phones?: unknown[];
  };
  const dataIssues = (q.duplicate_profiles?.length ?? 0) + (q.duplicate_teacher_invites?.length ?? 0) + (q.teacher_phones?.length ?? 0);

  return { withoutTeacher, reportsMissing, dataIssues };
}
