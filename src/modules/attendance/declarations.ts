import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { dayLessons } from "./dayLessons";
import { toMinutes } from "./rules";

type DB = SupabaseClient<Database>;

export interface DeclarationPrompt {
  meetingId: string;
  volumeName: string;
  sequence: number;
  /** YYYY-MM-DD */
  date: string;
  closesAt: string;
  lessons: { number: number; start: string; end: string; subject: string | null }[];
  /** O que o aluno já respondeu (se já respondeu). */
  declared: { lessons: number[]; status: "pending" | "validated" | "revoked" } | null;
}

/**
 * Encontros em que a coordenação abriu a janela de autodeclaração e que são da turma
 * do aluno: a pergunta "você esteve?" aparece até o prazo; depois de responder, só mostra a resposta.
 */
export async function loadDeclarationPrompts(supabase: DB, studentId: string): Promise<DeclarationPrompt[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", studentId)
    .in("status", ["active", "regularization", "approved"]);
  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];
  if (classIds.length === 0) return [];

  const { data: windows } = await supabase
    .from("attendance_declaration_windows")
    .select("meeting_id, closes_at")
    .eq("enabled", true);
  const windowByMeeting = new Map((windows ?? []).map((w) => [w.meeting_id, w.closes_at]));
  if (windowByMeeting.size === 0) return [];

  const [{ data: meetings }, { data: declarations }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select(
        "id, class_id, sequence, meeting_date, start_time, end_time, break_minutes, classes!inner(season_volume_offerings!inner(volumes!inner(name)))",
      )
      .in("id", [...windowByMeeting.keys()])
      .in("class_id", classIds),
    supabase.from("attendance_declarations").select("meeting_id, lessons, status").eq("student_id", studentId),
  ]);

  const now = Date.now();
  const prompts: DeclarationPrompt[] = [];
  for (const m of meetings ?? []) {
    if (!m.meeting_date || !m.start_time || !m.end_time) continue;
    const closesAt = windowByMeeting.get(m.id)!;
    const declared = (declarations ?? []).find((d) => d.meeting_id === m.id);
    // Depois do prazo, quem não respondeu não vê mais a pergunta; quem respondeu continua vendo a resposta.
    if (!declared && new Date(closesAt).getTime() < now) continue;

    const { data: subjectRows } = await supabase.rpc("class_meeting_subjects", { p_class_id: m.class_id });
    const subjects = (subjectRows ?? [])
      .filter((s) => s.meeting_id === m.id)
      .map((s) => ({ start: toMinutes(s.start_time), end: toMinutes(s.end_time), name: s.subject ?? "Matéria" }));
    const lessons = dayLessons({ startTime: m.start_time, endTime: m.end_time, breakMinutes: m.break_minutes }, subjects);

    prompts.push({
      meetingId: m.id,
      volumeName: m.classes.season_volume_offerings.volumes.name,
      sequence: m.sequence,
      date: m.meeting_date,
      closesAt,
      lessons: lessons.map((l) => ({ number: l.number, start: l.start, end: l.end, subject: l.subject })),
      declared: declared
        ? { lessons: [...declared.lessons].sort((a, b) => a - b), status: declared.status as "pending" | "validated" | "revoked" }
        : null,
    });
  }
  return prompts.sort((a, b) => a.date.localeCompare(b.date));
}
