import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { toMinutes } from "./rules";

type DB = SupabaseClient<Database>;

export interface MeetingRow {
  id: string;
  classId: string;
  sequence: number;
  date: string;
  start: string;
  end: string;
  minutes: number;
  breakMinutes: number;
  started: boolean;
  past: boolean;
}

export interface ClassInfo {
  id: string;
  volumeName: string;
  schedule: string;
  meetings: MeetingRow[];
  roster: Person[];
}

export interface Person {
  key: string;
  name: string;
  cpfLast4: string | null;
}

export interface ManualRow {
  id: string;
  meetingId: string;
  personKey: string;
  lessons: number[];
}

export interface ScanRow {
  id: string;
  meetingId: string;
  personKey: string;
  block: number;
  scannedAt: string;
  lessonsCredited: number;
  lessonsTotal: number;
  minutes: number;
  makeupFor: string | null;
  locationStatus: string;
  /** Aulas exatas que o aluno marcou; nulo nos registros antigos (deduzidas pelo horário). */
  lessonNumbers: number[] | null;
}

/** O PostgREST devolve no máximo 1000 linhas por consulta: pagina até o fim. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/**
 * Turmas, encontros, quem é de cada turma e todos os escaneamentos. Quem é
 * da turma vem da inscrição aprovada (volume principal e segundo volume) e,
 * se a pessoa já tem matrícula naquele volume, da matrícula, que vence.
 */
export async function loadAttendanceData(supabase: DB, today: string, nowMinute: number, seasonId: string) {
  const [classes, meetings, requests, enrollments, scans, manual] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("classes")
        .select("id, class_templates!inner(slug), season_volume_offerings!inner(season_id, volumes!inner(name, slug))")
        .eq("season_volume_offerings.season_id", seasonId)
        .order("created_at")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("class_meetings")
        .select("id, class_id, sequence, meeting_date, start_time, end_time, break_minutes, academic_minutes")
        .neq("status", "canceled")
        .order("meeting_date")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("enrollment_requests")
        .select("id, full_name, cpf_last4, student_id, primary_volume_slug, primary_schedule_slug, secondary_volume_slug, secondary_schedule_slug")
        .eq("status", "approved")
        .eq("season_id", seasonId)
        .order("full_name")
        .range(a, b),
    ),
    fetchAll((a, b) => supabase.from("enrollments").select("student_id, class_id").eq("status", "active").range(a, b)),
    fetchAll((a, b) =>
      supabase
        .from("attendance_scans")
        .select(
          "id, meeting_id, enrollment_request_id, student_id, block, scanned_at, lessons_credited, lessons_total, recognized_minutes, makeup_for_meeting_id, location_status, lesson_numbers",
        )
        .order("scanned_at")
        .range(a, b),
    ),
    // Antes da migration 061 a tabela não existe: a leitura falha e volta vazia.
    fetchAll((a, b) =>
      supabase.from("attendance_manual_entries").select("id, meeting_id, enrollment_request_id, student_id, lessons").range(a, b),
    ),
  ]);

  const classById = new Map<string, ClassInfo & { volumeSlug: string }>();
  const classByKey = new Map<string, string>();
  for (const c of classes) {
    const volume = c.season_volume_offerings.volumes;
    const info = { id: c.id, volumeName: volume.name, volumeSlug: volume.slug, schedule: c.class_templates.slug, meetings: [], roster: [] };
    classById.set(c.id, info);
    const key = `${volume.slug}|${c.class_templates.slug}`;
    if (!classByKey.has(key)) classByKey.set(key, c.id);
  }

  for (const m of meetings) {
    const cls = classById.get(m.class_id);
    if (!cls || !m.meeting_date || !m.start_time || !m.end_time) continue;
    const started = m.meeting_date < today || (m.meeting_date === today && toMinutes(m.start_time) <= nowMinute);
    const past = m.meeting_date < today || (m.meeting_date === today && toMinutes(m.end_time) <= nowMinute);
    cls.meetings.push({
      id: m.id,
      classId: m.class_id,
      sequence: m.sequence,
      date: m.meeting_date,
      start: m.start_time.slice(0, 5),
      end: m.end_time.slice(0, 5),
      minutes: m.academic_minutes,
      breakMinutes: m.break_minutes,
      started,
      past,
    });
  }

  const enrollmentByStudent = new Map<string, string[]>();
  for (const e of enrollments) {
    if (!e.student_id) continue;
    enrollmentByStudent.set(e.student_id, [...(enrollmentByStudent.get(e.student_id) ?? []), e.class_id]);
  }

  const names = new Map<string, string>();
  const linkedStudents = new Set<string>();
  for (const r of requests) {
    const person = { key: `r:${r.id}`, name: r.full_name, cpfLast4: r.cpf_last4 };
    names.set(person.key, r.full_name);
    if (r.student_id) linkedStudents.add(r.student_id);
    const pairs = [[r.primary_volume_slug, r.primary_schedule_slug]];
    if (r.secondary_volume_slug && r.secondary_schedule_slug) pairs.push([r.secondary_volume_slug, r.secondary_schedule_slug]);
    for (const [volume, schedule] of pairs) {
      const enrolled = (enrollmentByStudent.get(r.student_id ?? "") ?? []).find((id) => classById.get(id)?.volumeSlug === volume);
      const classId = enrolled ?? classByKey.get(`${volume}|${schedule}`);
      if (classId) classById.get(classId)?.roster.push(person);
    }
  }

  // Matrícula sem inscrição pública ligada (ex.: aluno importado por planilha).
  const orphanIds = [...enrollmentByStudent.keys()].filter((id) => !linkedStudents.has(id));
  if (orphanIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", orphanIds);
    for (const p of profiles ?? []) {
      const person = { key: `s:${p.id}`, name: p.full_name, cpfLast4: null };
      names.set(person.key, p.full_name);
      for (const classId of enrollmentByStudent.get(p.id) ?? []) classById.get(classId)?.roster.push(person);
    }
  }

  const scanRows: ScanRow[] = scans.map((s) => ({
    id: s.id,
    meetingId: s.meeting_id,
    personKey: s.enrollment_request_id ? `r:${s.enrollment_request_id}` : `s:${s.student_id}`,
    block: s.block,
    scannedAt: s.scanned_at,
    lessonsCredited: s.lessons_credited,
    lessonsTotal: s.lessons_total,
    minutes: s.recognized_minutes,
    makeupFor: s.makeup_for_meeting_id,
    locationStatus: s.location_status,
    lessonNumbers: s.lesson_numbers,
  }));

  const allClasses = [...classById.values()].sort((a, b) =>
    `${a.volumeName}${a.schedule}`.localeCompare(`${b.volumeName}${b.schedule}`),
  );
  for (const c of allClasses) c.roster.sort((a, b) => a.name.localeCompare(b.name));
  const manualRows: ManualRow[] = manual.map((m) => ({
    id: m.id,
    meetingId: m.meeting_id,
    personKey: m.enrollment_request_id ? `r:${m.enrollment_request_id}` : `s:${m.student_id}`,
    lessons: [...m.lessons].sort((x, y) => x - y),
  }));
  return { classes: allClasses, scans: scanRows, manual: manualRows, names };
}

/** Números das aulas do encontro que um escaneamento reconhece (bloco 2 continua a numeração). */
export function scanLessons(s: Pick<ScanRow, "block" | "lessonsCredited" | "lessonsTotal"> & { lessonNumbers?: number[] | null }): number[] {
  if (s.lessonNumbers && s.lessonNumbers.length > 0) return [...s.lessonNumbers].sort((a, b) => a - b);
  const offset = s.block === 2 ? s.lessonsTotal : 0;
  return Array.from({ length: s.lessonsCredited }, (_, i) => s.lessonsTotal - s.lessonsCredited + 1 + i + offset);
}
