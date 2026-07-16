/**
 * Correção automática de exercício (doc 02 §5.5/§5.6). Função pura que
 * espelha exatamente a lógica implementada em SQL dentro de
 * `submit_activity_attempt` (supabase/migrations/
 * 00000000000023_question_bank_and_activities.sql) — mantida aqui só
 * para poder testar o algoritmo de correção isoladamente, sem banco.
 * A correção "de verdade" em produção roda sempre no servidor (a função
 * SQL), nunca confiando em um resultado calculado no cliente.
 */

export interface SubmittedAnswer {
  questionId: string;
  selectedOptionIds: string[];
}

export interface GradedAnswer {
  questionId: string;
  isCorrect: boolean;
}

export interface GradeResult {
  answers: GradedAnswer[];
  correctCount: number;
  totalCount: number;
}

/** Verdadeiro só quando o conjunto selecionado é EXATAMENTE o conjunto correto. */
export function isAnswerCorrect(
  selectedOptionIds: readonly string[],
  correctOptionIds: readonly string[],
): boolean {
  if (selectedOptionIds.length === 0 || correctOptionIds.length === 0) {
    return false;
  }

  const selected = new Set(selectedOptionIds);
  const correct = new Set(correctOptionIds);

  if (selected.size !== correct.size) {
    return false;
  }

  for (const id of selected) {
    if (!correct.has(id)) {
      return false;
    }
  }

  return true;
}

export function gradeActivityAttempt(
  answers: readonly SubmittedAnswer[],
  correctOptionsByQuestionId: ReadonlyMap<string, readonly string[]>,
): GradeResult {
  const graded = answers.map((answer): GradedAnswer => {
    const correctOptionIds = correctOptionsByQuestionId.get(answer.questionId);
    return {
      questionId: answer.questionId,
      isCorrect: correctOptionIds
        ? isAnswerCorrect(answer.selectedOptionIds, correctOptionIds)
        : false,
    };
  });

  return {
    answers: graded,
    correctCount: graded.filter((a) => a.isCorrect).length,
    totalCount: graded.length,
  };
}
