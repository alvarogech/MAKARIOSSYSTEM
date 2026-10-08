import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { buildOverview, type Overview, type OverviewClass, type OverviewCredit } from "./overview";
import { toMinutes } from "./rules";
import { loadReportActiveByClass } from "@/modules/teaching/reportSettingsLoader";

type DB = SupabaseClient<Database>;

const SCHEDULE: Record<string, string> = { terca_quinta: "Terça/quinta", sabado: "Sábado" };

export interface OverviewFilters {
  volume?: string;
  classId?: string;
  from?: string;
  to?: string;
}

export interface LoadedOverview {
  overview: Overview;
  classOptions: { id: string; label: string; volume: string }[];
  /** Linhas do mapa turma × encontro. */
  maxSequence: number;
}

function nowMinuteSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Carrega tudo da temporada com a sessão da coordenação (as funções do banco só entregam isso a coordenação/admin). */
export async function loadOverview(supabase: DB, seasonId: string, filters: OverviewFilters = {}): Promise<LoadedOverview> {
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, class_templates!inner(slug), season_volume_offerings!inner(season_id, volumes!inner(name, order_index))")
    .eq("season_volume_offerings.season_id", seasonId);

  const sortedClasses = [...(classRows ?? [])].sort(
    (a, b) =>
      a.season_volume_offerings.volumes.order_index - b.season_volume_offerings.volumes.order_index ||
      a.class_templates.slug.localeCompare(b.class_templates.slug),
  );
  const classIds = sortedClasses.map((c) => c.id);
  if (classIds.length === 0) {
    return { overview: buildOverview([], []), classOptions: [], maxSequence: 0 };
  }

  const [{ data: meetings }, rosters, { data: creditRows }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select("id, class_id, sequence, meeting_date, end_time, academic_minutes")
      .in("class_id", classIds)
      .neq("status", "canceled")
      .order("meeting_date"),
    Promise.all(classIds.map((id) => supabase.rpc("class_roster", { p_class_id: id }))),
    supabase.rpc("attendance_credits"),
  ]);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const [{ data: blocks }, { data: reports }] = meetingIds.length
    ? await Promise.all([
        supabase.from("class_meeting_blocks").select("class_meeting_id, teacher_id, teacher_label, status").in("class_meeting_id", meetingIds),
        supabase.from("class_meeting_reports").select("meeting_id").in("meeting_id", meetingIds),
      ])
    : [{ data: [] }, { data: [] }];

  // Temporada com o relatório pós-aula desligado não gera alerta de "sem relatório".
  const reportActiveByClass = await loadReportActiveByClass(supabase, classIds);

  const today = getSaoPauloDateKey(new Date());
  const nowMinute = nowMinuteSaoPaulo();
  const teacherByMeeting = new Set((blocks ?? []).filter((b) => (b.teacher_id || b.teacher_label) && b.status !== "canceled").map((b) => b.class_meeting_id));
  const reportByMeeting = new Set((reports ?? []).map((r) => r.meeting_id));

  const classes: OverviewClass[] = sortedClasses.map((klass, i) => {
    const volume = klass.season_volume_offerings.volumes.name;
    const schedule = SCHEDULE[klass.class_templates.slug] ?? klass.class_templates.slug;
    return {
      id: klass.id,
      volume,
      schedule,
      label: `${volume}, ${schedule.toLowerCase()}`,
      reportRequired: reportActiveByClass.get(klass.id) === true,
      meetings: (meetings ?? [])
        .filter((m) => m.class_id === klass.id && m.meeting_date)
        .map((m) => ({
          id: m.id,
          sequence: m.sequence,
          date: m.meeting_date!,
          minutes: m.academic_minutes,
          past: m.meeting_date! < today || (m.meeting_date === today && m.end_time != null && toMinutes(m.end_time) <= nowMinute),
          lessonCount: Math.max(1, Math.round(m.academic_minutes / 60)),
          hasTeacher: teacherByMeeting.has(m.id),
          hasReport: reportByMeeting.has(m.id),
        })),
      roster: (rosters[i]?.data ?? []).map((p) => ({ key: p.person_key, name: p.full_name, phone: p.phone, stage: p.stage })),
    };
  });

  const classOptions = classes.map((c) => ({ id: c.id, label: c.label, volume: c.volume }));
  const filtered = classes
    .filter((c) => !filters.volume || c.volume === filters.volume)
    .filter((c) => !filters.classId || c.id === filters.classId);

  const overview = buildOverview(filtered, (creditRows ?? []) as OverviewCredit[], { from: filters.from, to: filters.to });
  const maxSequence = Math.max(0, ...filtered.flatMap((c) => c.meetings.map((m) => m.sequence)));
  return { overview, classOptions, maxSequence };
}
