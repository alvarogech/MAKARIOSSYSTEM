import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { lessonStatuses, toProgressCredits, type CreditRow, type LessonStatus } from "./credits";
import { dayLessons } from "./dayLessons";
import { computeProgress, MIN_ATTENDANCE_RATIO, type Progress } from "./progress";
import { toMinutes } from "./rules";

type DB = SupabaseClient<Database>;

export interface LessonView {
  number: number;
  start: string;
  end: string;
  subject: string | null;
  status: LessonStatus;
}

export interface MeetingView {
  id: string;
  sequence: number;
  date: string;
  start: string;
  end: string;
  lessons: LessonView[];
  /** O encontro já terminou. */
  past: boolean;
}

export interface FrequencyView {
  progress: Progress;
  /** Horas que pode perder no total sem passar de 25% (limite). */
  allowedMissMinutes: number;
  /** Horas que ainda precisa repor para voltar aos 75% (0 se já está dentro). */
  requiredMakeupMinutes: number;
  /** Encontros já realizados contam como "presença até agora". */
  heldMinutes: number;
}

export interface VolumeFrequency extends FrequencyView {
  classId: string;
  volumeName: string;
  scheduleLabel: string;
  meetings: MeetingView[];
}

const SCHEDULE_LABELS: Record<string, string> = { terca_quinta: "Terça e quinta", sabado: "Sábado" };

export function describeFrequency(progress: Progress): FrequencyView {
  const allowedMissMinutes = Math.floor(progress.totalMinutes * (1 - MIN_ATTENDANCE_RATIO));
  return {
    progress,
    allowedMissMinutes,
    requiredMakeupMinutes: Math.max(0, progress.missedMinutes - allowedMissMinutes),
    heldMinutes: progress.attendedMinutes + progress.missedMinutes,
  };
}

function nowMinuteSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Frequência do próprio aluno, por turma em que está matriculado. Roda com a sessão do aluno (RLS + funções do banco). */
export async function loadStudentFrequency(supabase: DB, studentId: string): Promise<VolumeFrequency[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", studentId)
    .in("status", ["active", "regularization", "approved"]);
  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];
  if (classIds.length === 0) return [];

  const [{ data: classes }, { data: meetings }, { data: creditRows }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, class_templates!inner(slug), season_volume_offerings!inner(volumes!inner(name))")
      .in("id", classIds),
    supabase
      .from("class_meetings")
      .select("id, class_id, sequence, meeting_date, start_time, end_time, break_minutes, academic_minutes")
      .in("class_id", classIds)
      .neq("status", "canceled")
      .order("meeting_date"),
    supabase.rpc("attendance_credits"),
  ]);

  const today = getSaoPauloDateKey(new Date());
  const nowMinute = nowMinuteSaoPaulo();
  const credits = (creditRows ?? []) as CreditRow[];

  const result: VolumeFrequency[] = [];
  for (const klass of classes ?? []) {
    const { data: subjectRows } = await supabase.rpc("class_meeting_subjects", { p_class_id: klass.id });
    const classMeetings = (meetings ?? []).filter((m) => m.class_id === klass.id && m.meeting_date && m.start_time && m.end_time);

    const meetingInfos = classMeetings.map((m) => {
      const past = m.meeting_date! < today || (m.meeting_date === today && toMinutes(m.end_time!) <= nowMinute);
      return { id: m.id, minutes: m.academic_minutes, past };
    });
    const progress = computeProgress(meetingInfos, toProgressCredits(credits));

    const views: MeetingView[] = classMeetings.map((m) => {
      const subjects = (subjectRows ?? [])
        .filter((s) => s.meeting_id === m.id && s.start_time && s.end_time)
        .map((s) => ({ start: toMinutes(s.start_time), end: toMinutes(s.end_time), name: s.subject ?? "Matéria" }));
      const lessons = dayLessons(
        { startTime: m.start_time!, endTime: m.end_time!, breakMinutes: m.break_minutes },
        subjects,
      );
      const own = credits.filter((c) => c.meeting_id === m.id && c.counts_for_meeting_id === m.id);
      const present = [...new Set(own.filter((c) => c.source !== "autodeclaracao").flatMap((c) => c.lessons ?? []))];
      const declared = [
        ...new Set(own.filter((c) => c.source === "autodeclaracao").flatMap((c) => c.lessons ?? [])),
      ].filter((n) => !present.includes(n));
      const makeupMinutes = credits
        .filter((c) => c.counts_for_meeting_id === m.id && c.meeting_id !== m.id)
        .reduce((sum, c) => sum + c.minutes, 0);
      const statuses = lessonStatuses({
        lessons: lessons.map((l) => ({ number: l.number, startMinute: toMinutes(l.start) })),
        present,
        declared,
        makeupMinutes,
        meetingDate: m.meeting_date!,
        today,
        nowMinute,
      });
      return {
        id: m.id,
        sequence: m.sequence,
        date: m.meeting_date!,
        start: m.start_time!.slice(0, 5),
        end: m.end_time!.slice(0, 5),
        lessons: lessons.map((l) => ({ ...l, status: statuses.get(l.number) ?? "futuro" })),
        past: meetingInfos.find((i) => i.id === m.id)?.past ?? false,
      };
    });

    result.push({
      ...describeFrequency(progress),
      classId: klass.id,
      volumeName: klass.season_volume_offerings.volumes.name,
      scheduleLabel: SCHEDULE_LABELS[klass.class_templates.slug] ?? klass.class_templates.slug,
      meetings: views,
    });
  }
  return result;
}
