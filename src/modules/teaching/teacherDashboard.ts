import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addSaoPauloDays, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { toProgressCredits, type CreditRow } from "@/modules/attendance/credits";
import { computeProgress } from "@/modules/attendance/progress";
import { loadClassJourney } from "@/modules/learning/classJourney";
import { loadPendingReports, type PendingReport } from "./pendingReports";
import { loadTeacherHomeSummary, type TeacherHomeSummary } from "./teacherHome";

type DB = SupabaseClient<Database>;

export interface TeacherIndicators {
  /** Alunos em "Atenção" (no limite ou abaixo dos 75%) nas turmas dele; null = sem dados. */
  attention: number | null;
  /** Frequência média sobre as horas dos encontros já realizados; null = sem dados. */
  averagePercent: number | null;
  lessonsDone: number;
  lessonsPlanned: number;
}

export interface NewMaterial {
  id: string;
  title: string;
}

export interface ClassParticipation {
  classId: string;
  volumeName: string;
  className: string;
  /** Participação média nos desafios publicados (0-100); null = sem dados. */
  percent: number | null;
  doubts: number;
}

export interface TeacherDashboardData {
  summary: TeacherHomeSummary;
  participation: ClassParticipation[];
  pendingReports: PendingReport[];
  indicators: TeacherIndicators;
  newMaterials: NewMaterial[];
}

/** Atenção e frequência média das turmas do professor, sobre o que já aconteceu — a mesma conta da coordenação. */
async function loadIndicators(supabase: DB, classIds: string[]): Promise<Pick<TeacherIndicators, "attention" | "averagePercent">> {
  if (classIds.length === 0) return { attention: null, averagePercent: null };

  const todayKey = getSaoPauloDateKey(new Date());
  const { data: meetings } = await supabase
    .from("class_meetings")
    .select("id, class_id, meeting_date, academic_minutes, status")
    .in("class_id", classIds);

  let attention = 0;
  let attended = 0;
  let held = 0;
  let people = 0;

  for (const classId of classIds) {
    const infos = (meetings ?? [])
      .filter((m) => m.class_id === classId && m.status !== "canceled")
      .map((m) => ({ id: m.id, minutes: m.academic_minutes, past: Boolean(m.meeting_date && m.meeting_date < todayKey) }));
    if (!infos.some((i) => i.past)) continue; // nada realizado ainda nesta turma: sem dados

    const [{ data: roster }, { data: creditRows }] = await Promise.all([
      supabase.rpc("class_roster", { p_class_id: classId }),
      supabase.rpc("attendance_credits", { p_class_id: classId }),
    ]);
    const byPerson = new Map<string, CreditRow[]>();
    for (const row of (creditRows ?? []) as (CreditRow & { person_key: string })[]) {
      byPerson.set(row.person_key, [...(byPerson.get(row.person_key) ?? []), row]);
    }
    for (const person of roster ?? []) {
      const progress = computeProgress(infos, toProgressCredits(byPerson.get(person.person_key) ?? []));
      people += 1;
      attended += progress.attendedMinutes;
      held += progress.attendedMinutes + progress.missedMinutes;
      if (progress.situation !== "em_dia") attention += 1;
    }
  }

  if (people === 0 || held === 0) return { attention: people === 0 ? null : attention, averagePercent: null };
  return { attention, averagePercent: Math.round((attended / held) * 100) };
}

/** Materiais publicados nos últimos 7 dias nos temas que o professor ministra. */
async function loadNewMaterials(supabase: DB, volumeIds: string[], moduleIds: string[]): Promise<NewMaterial[]> {
  if (volumeIds.length === 0 || moduleIds.length === 0) return [];
  const since = addSaoPauloDays(new Date(), -7).toISOString();
  const { data } = await supabase
    .from("contents")
    .select("id, title, created_at, lesson:lessons(module_id)")
    .in("volume_id", volumeIds)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? [])
    .filter((c) => c.lesson?.module_id && moduleIds.includes(c.lesson.module_id))
    .slice(0, 5)
    .map((c) => ({ id: c.id, title: c.title }));
}

/** Participação média nos desafios de fixação de cada turma (só agregados); sem desafio publicado ou sem aluno = sem dados. */
async function loadParticipation(supabase: DB, classes: TeacherHomeSummary["classes"]): Promise<ClassParticipation[]> {
  return Promise.all(
    classes.map(async (klass) => {
      const journey = await loadClassJourney(supabase, klass.classId);
      const published = (journey?.modules ?? []).filter((m) => m.activitiesPublished > 0);
      const percent =
        !journey || journey.students === 0 || published.length === 0
          ? null
          : Math.round((published.reduce((sum, m) => sum + m.studentsDoneActivity, 0) / (published.length * journey.students)) * 100);
      return { classId: klass.classId, volumeName: klass.volumeName, className: klass.className, percent, doubts: journey?.doubts.length ?? 0 };
    }),
  );
}

export async function loadTeacherDashboard(supabase: DB, teacherId: string): Promise<TeacherDashboardData> {
  const summary = await loadTeacherHomeSummary(supabase, teacherId);
  const classIds = summary.classes.map((c) => c.classId);
  const [pendingReports, indicators, newMaterials, participation] = await Promise.all([
    loadPendingReports(supabase, teacherId),
    loadIndicators(supabase, classIds),
    loadNewMaterials(supabase, summary.volumeIds, summary.myModuleIds),
    loadParticipation(supabase, summary.classes),
  ]);
  return {
    summary,
    participation,
    pendingReports,
    indicators: { ...indicators, lessonsDone: summary.lessonsDone, lessonsPlanned: summary.lessonsPlanned },
    newMaterials,
  };
}
