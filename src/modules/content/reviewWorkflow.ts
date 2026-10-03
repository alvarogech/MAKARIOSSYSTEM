/**
 * Fluxo de revisão editorial de questões e desafios:
 * rascunho → em revisão → aprovada → (publicada) → arquivada.
 * As mesmas regras são reforçadas no banco (trigger enforce_review_workflow);
 * isto aqui só decide o que a interface oferece e valida o pedido cedo.
 */
export const REVIEW_STATUSES = ["draft", "in_review", "approved", "published", "archived"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  published: "Publicada",
  archived: "Arquivada",
};

export type ReviewAction = "submit_review" | "return_draft" | "approve" | "reopen" | "publish" | "archive";

export interface ReviewActionRule {
  from: ReviewStatus[];
  to: ReviewStatus;
  label: string;
  requiresApprover: boolean;
  /** Só vale para desafios — questões são publicadas através do exercício. */
  challengeOnly?: boolean;
}

export const REVIEW_ACTION_RULES: Record<ReviewAction, ReviewActionRule> = {
  submit_review: { from: ["draft"], to: "in_review", label: "Enviar para revisão", requiresApprover: false },
  return_draft: { from: ["in_review"], to: "draft", label: "Voltar para rascunho", requiresApprover: false },
  approve: { from: ["in_review"], to: "approved", label: "Aprovar", requiresApprover: true },
  reopen: { from: ["approved"], to: "in_review", label: "Reabrir para revisão", requiresApprover: true },
  publish: { from: ["approved"], to: "published", label: "Publicar", requiresApprover: true, challengeOnly: true },
  archive: { from: ["published"], to: "archived", label: "Arquivar", requiresApprover: true, challengeOnly: true },
};

export function isReviewAction(value: unknown): value is ReviewAction {
  return typeof value === "string" && value in REVIEW_ACTION_RULES;
}

export function availableActions(
  status: ReviewStatus,
  options: { canApprove: boolean; kind: "question" | "challenge" },
): ReviewAction[] {
  return (Object.keys(REVIEW_ACTION_RULES) as ReviewAction[]).filter((action) => {
    const rule = REVIEW_ACTION_RULES[action];
    if (!rule.from.includes(status)) return false;
    if (rule.requiresApprover && !options.canApprove) return false;
    if (rule.challengeOnly && options.kind !== "challenge") return false;
    return true;
  });
}

/** Resumo por estado — usado nos cabeçalhos de cada matéria. */
export function countByStatus(statuses: string[]): Record<ReviewStatus, number> {
  const counts = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0])) as Record<ReviewStatus, number>;
  for (const status of statuses) {
    if ((REVIEW_STATUSES as readonly string[]).includes(status)) counts[status as ReviewStatus] += 1;
  }
  return counts;
}
