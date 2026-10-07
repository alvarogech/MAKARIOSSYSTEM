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

/** Correção de UMA resposta — só existe depois que o aluno verificou (ou enviou o exercício). */
export interface AnswerFeedback {
  isCorrect: boolean;
  correctOptionIds: string[];
  explanation: string | null;
  bibleReference: string | null;
}

export interface SavedAnswer {
  questionId: string;
  selectedOptionIds: string[];
  feedback: AnswerFeedback | null;
}

export interface BeginActivityAttemptResult {
  ok: boolean;
  error?: string;
  attemptId?: string;
  questions?: ActivityQuestion[];
  answers?: SavedAnswer[];
}

type RawSavedAnswer = {
  questionId: string;
  selectedOptionIds: string[] | null;
  revealed: boolean;
  isCorrect: boolean | null;
  correctOptionIds: string[] | null;
  explanation: string | null;
  bibleReference: string | null;
};

function toSavedAnswers(raw: RawSavedAnswer[] | null): SavedAnswer[] {
  return (raw ?? []).map((a) => ({
    questionId: a.questionId,
    selectedOptionIds: a.selectedOptionIds ?? [],
    feedback:
      a.revealed && a.isCorrect !== null
        ? {
            isCorrect: a.isCorrect,
            correctOptionIds: a.correctOptionIds ?? [],
            explanation: a.explanation,
            bibleReference: a.bibleReference,
          }
        : null,
  }));
}

async function requireStudent() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  return createSupabaseServerClient();
}

/**
 * Inicia (ou retoma) a tentativa em andamento e devolve as questões SEM o
 * gabarito, junto com o que já foi salvo — assim atualizar a página ou perder
 * a conexão não perde nada. Tudo pelas funções SECURITY DEFINER do banco, que
 * conferem matrícula, publicação e dono da tentativa.
 */
export async function beginActivityAttempt(activityId: string): Promise<BeginActivityAttemptResult> {
  const supabase = await requireStudent();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const { data: attempt, error: attemptError } = await supabase.rpc("start_activity_attempt", {
    p_activity_id: activityId,
  });
  if (attemptError || !attempt) {
    return { ok: false, error: attemptError?.message ?? "Não foi possível iniciar o exercício." };
  }

  const [{ data: questions, error: questionsError }, { data: saved }] = await Promise.all([
    supabase.rpc("get_activity_questions_for_attempt", { p_attempt_id: attempt.id }),
    supabase.rpc("get_activity_attempt_answers", { p_attempt_id: attempt.id }),
  ]);
  if (questionsError) return { ok: false, error: "Não foi possível carregar as questões." };

  return {
    ok: true,
    attemptId: attempt.id,
    questions: (questions as ActivityQuestion[] | null) ?? [],
    answers: toSavedAnswers(saved as RawSavedAnswer[] | null),
  };
}

/** Salva a seleção atual de uma questão. O cliente só mostra "salva" depois deste retorno. */
export async function saveActivityAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await requireStudent();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const { error } = await supabase.rpc("save_activity_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected: selectedOptionIds,
  });
  return error ? { ok: false, error: "Não foi possível salvar." } : { ok: true };
}

/** Verifica uma resposta já salva e devolve correção, explicação e referência da apostila. */
export async function checkActivityAnswer(
  attemptId: string,
  questionId: string,
): Promise<{ ok: boolean; error?: string; feedback?: AnswerFeedback }> {
  const supabase = await requireStudent();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const { data, error } = await supabase.rpc("check_activity_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível verificar agora." };

  const result = data as { isCorrect: boolean; correctOptionIds: string[]; explanation: string | null; bibleReference: string | null };
  return {
    ok: true,
    feedback: {
      isCorrect: result.isCorrect,
      correctOptionIds: result.correctOptionIds ?? [],
      explanation: result.explanation,
      bibleReference: result.bibleReference,
    },
  };
}

export interface SubmitActivityAttemptResult {
  ok: boolean;
  error?: string;
  correctCount?: number;
  totalCount?: number;
  answers?: SavedAnswer[];
}

/** Envio final: corrige tudo no servidor (o cliente nunca diz se acertou). */
export async function submitActivityAttempt(
  attemptId: string,
  answers: { questionId: string; selectedOptionIds: string[] }[],
): Promise<SubmitActivityAttemptResult> {
  const supabase = await requireStudent();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const { data, error } = await supabase.rpc("submit_activity_attempt", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível enviar o exercício." };

  const result = data as {
    correctCount: number;
    totalCount: number;
    showFeedback: boolean;
    answers: { questionId: string; isCorrect: boolean; correctOptionIds: string[]; explanation: string | null; bibleReference: string | null }[];
  };

  const byQuestion = new Map(result.answers.map((a) => [a.questionId, a]));
  return {
    ok: true,
    correctCount: result.correctCount,
    totalCount: result.totalCount,
    answers: answers.map((a) => {
      const graded = byQuestion.get(a.questionId);
      return {
        questionId: a.questionId,
        selectedOptionIds: a.selectedOptionIds,
        feedback: graded
          ? {
              isCorrect: graded.isCorrect,
              correctOptionIds: graded.correctOptionIds ?? [],
              explanation: graded.explanation,
              bibleReference: graded.bibleReference,
            }
          : null,
      };
    }),
  };
}

/** Revisão de uma tentativa já enviada (questões + o que foi respondido + correção). */
export async function loadAttemptReview(attemptId: string): Promise<BeginActivityAttemptResult> {
  const supabase = await requireStudent();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const [{ data: questions, error }, { data: saved }] = await Promise.all([
    supabase.rpc("get_activity_questions_for_attempt", { p_attempt_id: attemptId }),
    supabase.rpc("get_activity_attempt_answers", { p_attempt_id: attemptId }),
  ]);
  if (error) return { ok: false, error: "Não foi possível carregar a revisão." };

  return {
    ok: true,
    attemptId,
    questions: (questions as ActivityQuestion[] | null) ?? [],
    answers: toSavedAnswers(saved as RawSavedAnswer[] | null),
  };
}
