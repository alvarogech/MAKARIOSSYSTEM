/**
 * Regra de liberação do gabarito (doc 02 §7): liberado no primeiro
 * evento entre — todos os elegíveis enviaram / prazo encerrado /
 * liberação manual da coordenação. Espelha exatamente a lógica de
 * `evaluate_answer_key_release()` em SQL (supabase/migrations/
 * 00000000000034_assessment_cron.sql) — mantida aqui só para testar a
 * regra isoladamente.
 */

export type AnswerKeyReleaseReason = "all_submitted" | "deadline" | "manual";

export interface AnswerKeyReleaseInput {
  now: Date;
  closesAt: Date | null;
  manuallyReleased: boolean;
  /** Tamanho do conjunto FIXO de elegíveis (congelado na publicação). */
  eligibleCount: number;
  /** Quantos desse conjunto fixo já enviaram (submitted ou expired). */
  submittedCount: number;
}

export function evaluateAnswerKeyRelease(
  input: AnswerKeyReleaseInput,
): AnswerKeyReleaseReason | null {
  if (input.manuallyReleased) {
    return "manual";
  }

  if (input.eligibleCount > 0 && input.submittedCount >= input.eligibleCount) {
    return "all_submitted";
  }

  if (input.closesAt && input.now >= input.closesAt) {
    return "deadline";
  }

  return null;
}
