"use server";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getAuthContext } from "@/authorization";

export interface ActivityQuestionOption {
  optionId: string;
  label: string;
  orderIndex: number;
}

export interface ActivityQuestion {
  questionId: string;
  type: string;
  selectionMode: "single" | "multiple";
  prompt: string;
  orderIndex: number;
  options: ActivityQuestionOption[];
}

export interface BeginActivityAttemptResult {
  ok: boolean;
  error?: string;
  attemptId?: string;
  alreadySubmitted?: boolean;
  questions?: ActivityQuestion[];
}

/**
 * Inicia (ou reaproveita) a tentativa e devolve as questões SEM a
 * resposta correta — tudo via as funções SECURITY DEFINER do banco
 * (start_activity_attempt / get_activity_questions_for_attempt), que
 * fazem a própria checagem de que a tentativa pertence ao usuário.
 */
export async function beginActivityAttempt(
  activityId: string,
): Promise<BeginActivityAttemptResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: attempt, error: attemptError } = await supabase.rpc(
    "start_activity_attempt",
    { p_activity_id: activityId },
  );

  if (attemptError || !attempt) {
    return { ok: false, error: attemptError?.message ?? "Não foi possível iniciar o exercício." };
  }

  if (attempt.status === "submitted") {
    return { ok: true, attemptId: attempt.id, alreadySubmitted: true };
  }

  const { data: questions, error: questionsError } = await supabase.rpc(
    "get_activity_questions_for_attempt",
    { p_attempt_id: attempt.id },
  );

  if (questionsError) {
    return { ok: false, error: "Não foi possível carregar as questões." };
  }

  return {
    ok: true,
    attemptId: attempt.id,
    questions: (questions as ActivityQuestion[] | null) ?? [],
  };
}

export interface SubmitActivityAttemptResult {
  ok: boolean;
  error?: string;
  correctCount?: number;
  totalCount?: number;
  showFeedback?: boolean;
  answers?: {
    questionId: string;
    isCorrect: boolean;
    correctOptionIds: string[];
    explanation: string | null;
  }[];
}

export async function submitActivityAttempt(
  attemptId: string,
  answers: { questionId: string; selectedOptionIds: string[] }[],
): Promise<SubmitActivityAttemptResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("submit_activity_attempt", {
    p_attempt_id: attemptId,
    p_answers: answers.map((a) => ({
      questionId: a.questionId,
      selectedOptionIds: a.selectedOptionIds,
    })),
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Não foi possível enviar o exercício." };
  }

  const result = data as {
    correctCount: number;
    totalCount: number;
    showFeedback: boolean;
    answers: { questionId: string; isCorrect: boolean; correctOptionIds: string[]; explanation: string | null }[];
  };

  return { ok: true, ...result };
}
