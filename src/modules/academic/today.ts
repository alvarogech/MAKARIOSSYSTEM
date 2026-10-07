import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addSaoPauloDays, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import type { Anomaly, ClassStat, PersonStat } from "@/modules/attendance/overview";
import { loadOverview } from "@/modules/attendance/overviewLoader";
import { loadCoordinationAlerts, type CoordinationAlerts } from "./coordinationAlerts";

type DB = SupabaseClient<Database>;

export interface UpcomingMeeting {
  meetingId: string;
  classId: string;
  className: string;
  sequence: number;
  date: string;
  start: string;
  end: string;
  teachers: string[];
  subjects: string[];
}

export interface TodayData {
  upcoming: UpcomingMeeting[];
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
export async function loadToday(supabase: DB): Promise<TodayData> {
  const today = getSaoPauloDateKey(new Date());
  const until = getSaoPauloDateKey(addSaoPauloDays(new Date(), 7));

  const { data: seasons } = await supabase.from("seasons").select("id").order("starts_on", { ascending: false, nullsFirst: false }).limit(1);
  const seasonId = seasons?.[0]?.id ?? "";

  const [alerts, loaded, { data: meetings }, { count: pending }, { count: approvedNoAccount }, { count: pendingRequests }] = await Promise.all([
    loadCoordinationAlerts(supabase),
    seasonId ? loadOverview(supabase, seasonId) : Promise.resolve(null),
    supabase
      .from("class_meetings")
      .select("id, class_id, sequence, meeting_date, start_time, end_time, classes!inner(name)")
      .gte("meeting_date", today)
      .lte("meeting_date", until)
      .neq("status", "canceled")
      .order("meeting_date")
      .order("start_time"),
    supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "approved").is("student_id", null),
    supabase.from("attendance_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const { data: blocks } = meetingIds.length
    ? await supabase.from("class_meeting_blocks").select("class_meeting_id, teacher_id, teacher_label, module_id, status").in("class_meeting_id", meetingIds)
    : { data: [] as { class_meeting_id: string; teacher_id: string | null; teacher_label: string | null; module_id: string | null; status: string }[] };
  const teacherIds = [...new Set((blocks ?? []).map((b) => b.teacher_id).filter((x): x is string => Boolean(x)))];
  const moduleIds = [...new Set((blocks ?? []).map((b) => b.module_id).filter((x): x is string => Boolean(x)))];
  const [{ data: teachers }, { data: modules }] = await Promise.all([
    teacherIds.length ? supabase.from("profiles").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    moduleIds.length ? supabase.from("modules").select("id, name").in("id", moduleIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name.split(" ")[0] ?? t.full_name]));
  const moduleName = new Map((modules ?? []).map((m) => [m.id, m.name]));

  const upcoming: UpcomingMeeting[] = (meetings ?? [])
    .filter((m) => m.meeting_date && m.start_time && m.end_time)
    .map((m) => {
      const own = (blocks ?? []).filter((b) => b.class_meeting_id === m.id && b.status !== "canceled");
      return {
        meetingId: m.id,
        classId: m.class_id,
        className: m.classes.name,
        sequence: m.sequence,
        date: m.meeting_date!,
        start: m.start_time!.slice(0, 5),
        end: m.end_time!.slice(0, 5),
        teachers: [...new Set(own.map((b) => (b.teacher_id ? teacherName.get(b.teacher_id) : b.teacher_label?.replace(/^Pr[a]?\.\s*/, "").split(" ")[0]) ?? null).filter((x): x is string => Boolean(x)))],
        subjects: [...new Set(own.map((b) => (b.module_id ? moduleName.get(b.module_id) : null)).filter((x): x is string => Boolean(x)))],
      };
    });

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
