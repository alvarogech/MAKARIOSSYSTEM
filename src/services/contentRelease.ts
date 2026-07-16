/**
 * Avaliação de regra de liberação de conteúdo (doc 02 §3.3). Função pura:
 * recebe as regras de um conteúdo e o "estado" já resolvido do aluno
 * (conteúdos concluídos, atividades enviadas, encontros já ocorridos) —
 * não sabe nada de Postgres/data atual do servidor além do que recebe.
 *
 * Um conteúdo sem nenhuma regra cadastrada é tratado como liberado
 * (equivalente a uma regra "immediate" implícita) — decisão desta fase,
 * documentada em FASE_3_RELATORIO.md.
 */

export type ReleaseRuleType =
  | "immediate"
  | "date"
  | "manual"
  | "after_content"
  | "after_activity"
  | "after_meeting";

export interface ReleaseRule {
  type: ReleaseRuleType;
  releaseAt?: Date | null;
  requiredContentId?: string | null;
  requiredActivityId?: string | null;
  requiredMeetingId?: string | null;
  releasedManually?: boolean;
}

export interface ReleaseContext {
  now: Date;
  completedContentIds: ReadonlySet<string>;
  submittedActivityIds: ReadonlySet<string>;
  pastMeetingIds: ReadonlySet<string>;
}

export function isRuleSatisfied(
  rule: ReleaseRule,
  context: ReleaseContext,
): boolean {
  switch (rule.type) {
    case "immediate":
      return true;
    case "manual":
      return rule.releasedManually === true;
    case "date":
      return rule.releaseAt != null && context.now >= rule.releaseAt;
    case "after_content":
      return (
        rule.requiredContentId != null &&
        context.completedContentIds.has(rule.requiredContentId)
      );
    case "after_activity":
      return (
        rule.requiredActivityId != null &&
        context.submittedActivityIds.has(rule.requiredActivityId)
      );
    case "after_meeting":
      return (
        rule.requiredMeetingId != null &&
        context.pastMeetingIds.has(rule.requiredMeetingId)
      );
    default:
      return false;
  }
}

/** Um conteúdo é liberado se QUALQUER uma das suas regras for satisfeita (OR). */
export function isContentReleased(
  rules: readonly ReleaseRule[],
  context: ReleaseContext,
): boolean {
  if (rules.length === 0) {
    return true;
  }
  return rules.some((rule) => isRuleSatisfied(rule, context));
}
