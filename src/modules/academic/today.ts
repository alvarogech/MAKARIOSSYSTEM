import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addSaoPauloDays, getSaoPauloDateKey, getSaoPauloMinuteOfDay } from "@/lib/saoPauloDate";
import type { Anomaly, ClassStat, PersonStat } from "@/modules/attendance/overview";
import { loadOverview } from "@/modules/attendance/overviewLoader";
import { loadCoordinationAlerts, type CoordinationAlerts } from "./coordinationAlerts";
import {
  meetingTimeState,
  pickNextClassDay,
  scheduleLabelFromSlug,
  summarizeBlocks,
  type NextClassDay,
  type UpcomingMeeting,
} from "./nextClassDay";

export type { UpcomingMeeting } from "./nextClassDay";

type DB = SupabaseClient<Database>;

/** Mesma consulta de encontros usada na lista "Próximos 7 dias" — o "Próximo dia de aula" parte dela. */
const MEETING_SELECT =
  "id, class_id, sequence, meeting_date, start_time, end_time, status, classes!inner(name, status, class_templates!inner(slug), season_volume_offerings!inner(volumes!inner(name)))";

interface MeetingRow {
  id: string;
  class_id: string;
  sequence: number;
  meeting_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  classes: { name: string; status: string; class_templates: { slug: string }; season_volume_offerings: { volumes: { name: string } } };
}

/** Acrescenta matérias e professores (blocos da escala) e a situação de horário a cada encontro. */
async function hydrateMeetings(supabase: DB, rows: MeetingRow[], now: Date): Promise<UpcomingMeeting[]> {
  const todayKey = getSaoPauloDateKey(now);
  const nowMinute = getSaoPauloMinuteOfDay(now);

  const meetingIds = rows.map((m) => m.id);
  const { data: blocks } = meetingIds.length
    ? await supabase.from("class_meeting_blocks").select("class_meeting_id, teacher_id, teacher_label, module_id, status").in("class_meeting_id", meetingIds)
    : { data: [] as { class_meeting_id: string; teacher_id: string | null; teacher_label: string | null; module_id: string | null; status: string }[] };
  const teacherIds = [...new Set((blocks ?? []).map((b) => b.teacher_id).filter((x): x is string => Boolean(x)))];
  const moduleIds = [...new Set((blocks ?? []).map((b) => b.module_id).filter((x): x is string => Boolean(x)))];
  const [{ data: teachers }, { data: modules }] = await Promise.all([
    teacherIds.length ? supabase.from("profiles").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    moduleIds.length ? supabase.from("modules").select("id, name").in("id", moduleIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
  const moduleName = new Map((modules ?? []).map((m) => [m.id, m.name]));

  return rows
    .filter((m) => m.meeting_date && m.start_time && m.end_time)
    .map((m) => {
      const base = { date: m.meeting_date!, start: m.start_time!.slice(0, 5), end: m.end_time!.slice(0, 5) };
      return {
        meetingId: m.id,
        classId: m.class_id,
        className: m.classes.name,
        sequence: m.sequence,
        ...base,
        ...summarizeBlocks((blocks ?? []).filter((b) => b.class_meeting_id === m.id), teacherName, moduleName),
        volumeName: m.classes.season_volume_offerings.volumes.name,
        scheduleLabel: scheduleLabelFromSlug(m.classes.class_templates.slug),
        status: m.status,
        classStatus: m.classes.status,
        timeState: meetingTimeState(base, todayKey, nowMinute),
      };
    });
}

/**
 * Só roda quando a janela de 7 dias não tem aula válida (férias, recesso): acha a primeira data futura com aula
 * e carrega todas as aulas dessa data.
 */
async function loadMeetingsOnNextDateAfter(supabase: DB, afterDate: string, now: Date): Promise<{ meetings: UpcomingMeeting[]; failed: boolean }> {
  const { data: first, error } = await supabase
    .from("class_meetings")
    .select("meeting_date, classes!inner(status)")
    .gt("meeting_date", afterDate)
    .neq("status", "canceled")
    .neq("status", "done")
    .neq("classes.status", "closed")
    .not("start_time", "is", null)
    .not("end_time", "is", null)
    .order("meeting_date")
    .limit(1);
  if (error) return { meetings: [], failed: true };
  const date = first?.[0]?.meeting_date;
  if (!date) return { meetings: [], failed: false };

  const { data: rows, error: rowsError } = await supabase
    .from("class_meetings")
    .select(MEETING_SELECT)
    .eq("meeting_date", date)
    .neq("status", "canceled")
    .order("start_time");
  if (rowsError) return { meetings: [], failed: true };
  return { meetings: await hydrateMeetings(supabase, (rows ?? []) as unknown as MeetingRow[], now), failed: false };
}

export interface TodayData {
  upcoming: UpcomingMeeting[];
  /** Próxima data com aula (e todas as aulas dela); null = nenhuma aula programada. */
  nextClassDay: NextClassDay | null;
  /** A consulta do próximo dia falhou: a tela mostra um aviso discreto em vez de "sem aulas". */
  nextClassDayFailed: boolean;
  /** Dia de hoje em São Paulo ("YYYY-MM-DD"), para rótulos como "Hoje". */
  todayKey: string;
  alerts: CoordinationAlerts;
  anomalies: Anomaly[];
  lastMeetingByClass: { label: string; sequence: number; pct: number | null }[];
  bands: { emDia: number; atencao: number; critico: number; total: number };
  atRisk: { person: PersonStat; classLabel: string }[];
  pendingRequests: number;
  approvedWithoutAccount: number;
  pendingAttendanceRequests: number;
  avgPct: number | null;
}

/** Tudo da home da coordenação: só o que exige olhar ou ação agora. */
export async function loadToday(supabase: DB, now: Date = new Date()): Promise<TodayData> {
  const today = getSaoPauloDateKey(now);
  const until = getSaoPauloDateKey(addSaoPauloDays(now, 7));

  const { data: seasons } = await supabase.from("seasons").select("id").order("starts_on", { ascending: false, nullsFirst: false }).limit(1);
  const seasonId = seasons?.[0]?.id ?? "";

  const [alerts, loaded, { data: meetings, error: meetingsError }, { count: pending }, { count: approvedNoAccount }, { count: pendingRequests }] = await Promise.all([
    loadCoordinationAlerts(supabase),
    seasonId ? loadOverview(supabase, seasonId) : Promise.resolve(null),
    supabase
      .from("class_meetings")
      .select(MEETING_SELECT)
      .gte("meeting_date", today)
      .lte("meeting_date", until)
      .neq("status", "canceled")
      .order("meeting_date")
      .order("start_time"),
    supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "approved").is("student_id", null),
    supabase.from("attendance_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const upcoming = await hydrateMeetings(supabase, (meetings ?? []) as unknown as MeetingRow[], now);

  // O próximo dia sai da própria lista carregada; só vai ao banco de novo se a janela não tiver aula válida.
  let nextClassDay = pickNextClassDay(upcoming, now);
  let nextClassDayFailed = Boolean(meetingsError);
  if (!nextClassDay && !meetingsError) {
    const later = await loadMeetingsOnNextDateAfter(supabase, until, now);
    nextClassDay = pickNextClassDay(later.meetings, now);
    nextClassDayFailed = later.failed;
  }

  const overview = loaded?.overview;
  const lastMeetingByClass = (overview?.classes ?? []).flatMap((klass: ClassStat) => {
    const last = [...klass.meetings].filter((m) => m.past).sort((a, b) => b.sequence - a.sequence)[0];
    return last ? [{ label: klass.label, sequence: last.sequence, pct: last.pct }] : [];
  });

  const atRisk = (overview?.classes ?? [])
    .flatMap((klass) =>
      klass.people
        .filter((p) => p.progress.situation === "reprovado" || p.progress.situation === "no_limite")
        .map((p) => ({ person: p, classLabel: klass.label })),
    )
    .sort((a, b) => Number(b.person.progress.situation === "reprovado") - Number(a.person.progress.situation === "reprovado") || a.person.name.localeCompare(b.person.name))
    .slice(0, 5);

  return {
    upcoming,
    nextClassDay,
    nextClassDayFailed,
    todayKey: today,
    alerts,
    anomalies: (overview?.anomalies ?? []).slice(0, 4),
    lastMeetingByClass,
    bands: overview?.bands ?? { emDia: 0, atencao: 0, critico: 0, total: 0 },
    atRisk,
    pendingRequests: pending ?? 0,
    approvedWithoutAccount: approvedNoAccount ?? 0,
    pendingAttendanceRequests: pendingRequests ?? 0,
    avgPct: overview?.avgPct ?? null,
  };
}
