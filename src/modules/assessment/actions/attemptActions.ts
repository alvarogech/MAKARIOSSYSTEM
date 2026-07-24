"use server";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getAuthContext } from "@/authorization";

export interface AssessmentQuestionOption {
  optionId: string;
  label: string;
  orderIndex: number;
}

export interface AssessmentAttemptQuestion {
  questionId: string;
  position: number;
  prompt: string;
  questionType: string;
  selectionMode: "single" | "multiple";
  options: AssessmentQuestionOption[];
  answered: boolean;
}

export interface StartAttemptResult {
  ok: boolean;
  error?: string;
  attemptId?: string;
  deadlineAt?: string;
  status?: string;
}

/** Inicia (ou reaproveita) a tentativa — o prazo é sempre calculado no servidor. */
export async function startAssessmentAttempt(
  assessmentId: string,
): Promise<StartAttemptResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_assessment_attempt", {
    p_assessment_id: assessmentId,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Não foi possível iniciar a avaliação." };
  }

  return {
    ok: true,
    attemptId: data.id,
    deadlineAt: data.deadline_at,
    status: data.status,
  };
}

export interface GetAttemptQuestionsResult {
  ok: boolean;
  error?: string;
  questions?: AssessmentAttemptQuestion[];
}

export async function getAssessmentAttemptQuestions(
  attemptId: string,
): Promise<GetAttemptQuestionsResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_assessment_attempt_questions", {
    p_attempt_id: attemptId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, questions: (data as AssessmentAttemptQuestion[] | null) ?? [] };
}

export interface SubmitAnswerResult {
  ok: boolean;
  error?: string;
  alreadyAnswered?: boolean;
}

export async function submitAssessmentAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
): Promise<SubmitAnswerResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_assessment_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_option_ids: selectedOptionIds,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { alreadyAnswered: boolean };
  return { ok: true, alreadyAnswered: result.alreadyAnswered };
}

export interface FinalizeAttemptResult {
  ok: boolean;
  error?: string;
  score?: number;
  correctCount?: number;
  totalCount?: number;
}

export async function finalizeAssessmentAttempt(
  attemptId: string,
): Promise<FinalizeAttemptResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("finalize_assessment_attempt", {
    p_attempt_id: attemptId,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Não foi possível finalizar a avaliação." };
  }

  return {
    ok: true,
    score: data.score ?? undefined,
    correctCount: data.correct_count ?? undefined,
    totalCount: data.total_count ?? undefined,
  };
}

export interface AssessmentReviewQuestion {
  questionId: string;
  position: number;
  prompt: string;
  options: AssessmentQuestionOption[];
  correctOptionIds: string[];
  selectedOptionIds: string[];
  isCorrect: boolean;
  explanation: string | null;
  bibleReference: string | null;
}

export interface GetAttemptReviewResult {
  ok: boolean;
  error?: string;
  questions?: AssessmentReviewQuestion[];
}

/** Só funciona depois que o gabarito da avaliação foi liberado (checado no servidor). */
export async function getAssessmentAttemptReview(
  attemptId: string,
): Promise<GetAttemptReviewResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false, error: "Sessão expirada." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_assessment_attempt_review", {
    p_attempt_id: attemptId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, questions: (data as AssessmentReviewQuestion[] | null) ?? [] };
}
