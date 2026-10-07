import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildAchievements, type Achievement } from "./achievements";
import type { VolumeJourney } from "./journey";
import { buildWeeklyGoal, clampTarget, weekBounds, type WeeklyGoalView } from "./weeklyGoal";

type DB = SupabaseClient<Database>;

export interface StudentRewards {
  achievements: Achievement[];
  goal: WeeklyGoalView;
}

/**
 * Conquistas e meta semanal do próprio aluno. Roda com a sessão dele: o banco só entrega as próprias
 * tentativas, respostas e práticas. `journeys` (opcional) alimenta as conquistas de etapa concluída.
 */
export async function loadStudentRewards(supabase: DB, studentId: string, journeys: VolumeJourney[] = []): Promise<StudentRewards> {
  const { data: enrollments } = await supabase.from("enrollments").select("id").eq("student_id", studentId);
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);

  const [{ data: attempts }, { data: practices }, { count: contentRows }, { data: goalRow }] = await Promise.all([
    enrollmentIds.length
      ? supabase.from("activity_attempts").select("id, activity_id, started_at, submitted_at, status").in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [] as { id: string; activity_id: string; started_at: string; submitted_at: string | null; status: string }[] }),
    enrollmentIds.length
      ? supabase.from("challenge_completions").select("practiced_at").in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [] as { practiced_at: string }[] }),
    enrollmentIds.length
      ? supabase.from("content_progress").select("id", { count: "exact", head: true }).in("enrollment_id", enrollmentIds)
      : Promise.resolve({ count: 0 }),
    supabase.from("student_weekly_goals").select("enabled, target").eq("student_id", studentId).maybeSingle(),
  ]);

  const submitted = (attempts ?? []).filter((a) => a.status === "submitted" && a.submitted_at);
  const submittedById = new Map(submitted.map((a) => [a.id, a.submitted_at as string]));

  // Cada questão diferente conta uma vez, na data do primeiro envio em que foi acertada.
  const firstCorrectByQuestion = new Map<string, string>();
  if (submitted.length > 0) {
    const { data: answers } = await supabase
      .from("activity_answers")
      .select("attempt_id, question_id, is_correct")
      .in("attempt_id", [...submittedById.keys()])
      .eq("is_correct", true);
    for (const answer of answers ?? []) {
      const at = submittedById.get(answer.attempt_id);
      if (!at) continue;
      const current = firstCorrectByQuestion.get(answer.question_id);
      if (!current || at < current) firstCorrectByQuestion.set(answer.question_id, at);
    }
  }

  const completedStages = journeys.flatMap((j) => j.stages.filter((s) => s.state === "concluida" && s.actionsTotal > 0).map((s) => s.name));

  const achievements = buildAchievements({
    attempts: (attempts ?? []).map((a) => ({ activityId: a.activity_id, startedAt: a.started_at, submittedAt: a.status === "submitted" ? a.submitted_at : null })),
    correctQuestionDates: [...firstCorrectByQuestion.values()],
    practiceDates: (practices ?? []).map((p) => p.practiced_at),
    contentStarted: (contentRows ?? 0) > 0,
    completedStages,
  });

  const goal = buildWeeklyGoal({
    enabled: goalRow?.enabled ?? false,
    target: clampTarget(goalRow?.target ?? 2),
    submittedAts: submitted.map((a) => a.submitted_at as string),
    practicedAts: (practices ?? []).map((p) => p.practiced_at),
    bounds: weekBounds(new Date()),
  });

  return { achievements, goal };
}
