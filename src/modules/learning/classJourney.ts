import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ClassJourneyModule {
  moduleId: string;
  name: string;
  activitiesPublished: number;
  activitiesPending: number;
  challengesPublished: number;
  challengesPending: number;
  studentsDoneActivity: number;
  studentsDonePractice: number;
}

export interface ClassJourneyDoubt {
  questionId: string;
  prompt: string;
  moduleName: string;
  answered: number;
  wrong: number;
}

export interface ClassJourney {
  students: number;
  modules: ClassJourneyModule[];
  doubts: ClassJourneyDoubt[];
}

interface RawStats {
  students?: number;
  modules?: {
    module_id: string;
    name: string;
    activities_published: number;
    activities_pending: number;
    challenges_published: number;
    challenges_pending: number;
    students_done_activity: number;
    students_done_practice: number;
  }[];
  doubts?: { question_id: string; prompt: string; module_name: string; answered: number; wrong: number }[];
}

/**
 * Agregados da jornada de uma turma (participação por matéria e questões com dúvida recorrente).
 * Só contagens: a função do banco nunca devolve nome de aluno, resposta individual ou gabarito, e só
 * responde a professor da turma e coordenação. Devolve null se o acesso for negado ou falhar.
 */
export async function loadClassJourney(supabase: SupabaseClient<Database>, classId: string): Promise<ClassJourney | null> {
  const { data, error } = await supabase.rpc("class_journey_stats", { p_class_id: classId });
  if (error || !data) return null;
  const raw = data as unknown as RawStats;
  return {
    students: raw.students ?? 0,
    modules: (raw.modules ?? []).map((m) => ({
      moduleId: m.module_id,
      name: m.name,
      activitiesPublished: m.activities_published,
      activitiesPending: m.activities_pending,
      challengesPublished: m.challenges_published,
      challengesPending: m.challenges_pending,
      studentsDoneActivity: m.students_done_activity,
      studentsDonePractice: m.students_done_practice,
    })),
    doubts: (raw.doubts ?? []).map((d) => ({
      questionId: d.question_id,
      prompt: d.prompt,
      moduleName: d.module_name,
      answered: d.answered,
      wrong: d.wrong,
    })),
  };
}
