/**
 * Correção de avaliação (doc 02 §6). Reaproveita a mesma comparação de
 * conjuntos de `activityGrading.ts` (correta = seleção exatamente igual
 * ao gabarito da questão) — a única diferença é que aqui cada questão
 * tem um valor (`points`) que soma até `total_points` da avaliação
 * (10, por padrão), em vez de só contar acertos.
 */

import { isAnswerCorrect } from "./activityGrading";

export interface AssessmentAnswerInput {
  questionId: string;
  selectedOptionIds: readonly string[];
  points: number;
}

export interface AssessmentScoreResult {
  score: number;
  correctCount: number;
}

export function calculateAssessmentScore(
  answers: readonly AssessmentAnswerInput[],
  correctOptionsByQuestionId: ReadonlyMap<string, readonly string[]>,
): AssessmentScoreResult {
  let score = 0;
  let correctCount = 0;

  for (const answer of answers) {
    const correctIds = correctOptionsByQuestionId.get(answer.questionId);
    const isCorrect = correctIds
      ? isAnswerCorrect(answer.selectedOptionIds, correctIds)
      : false;

    if (isCorrect) {
      score += answer.points;
      correctCount += 1;
    }
  }

  return {
    score: Math.round(score * 100) / 100,
    correctCount,
  };
}

/** Mínimo padrão de 6,0 em 10 (doc 02 §6/§8). */
export function isGradeSufficient(grade: number, passingGrade = 6): boolean {
  return grade >= passingGrade;
}
