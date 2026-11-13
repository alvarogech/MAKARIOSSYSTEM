// Regra e texto da liberação da prova depois do prazo (espelha start_assessment_attempt, migração 087).
export const LATE_RELEASE_HOURS = 24;

/** O prazo (`closes_at`) já passou? Sem prazo, nunca passa. */
export function isPastDeadline(closesAt: string | null, now: Date = new Date()): boolean {
  return closesAt !== null && now.getTime() > new Date(closesAt).getTime();
}

/** A liberação vale agora? Só vale com `valid_until` no futuro. */
export function isReleaseActive(validUntil: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(validUntil) && new Date(validUntil as string).getTime() > now.getTime();
}

/** Mesma decisão do servidor: o prazo só barra quando passou e não há liberação ativa desta matrícula. */
export function isBlockedByDeadline(
  closesAt: string | null,
  validUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return isPastDeadline(closesAt, now) && !isReleaseActive(validUntil, now);
}

/** "14/11 às 10:30", no horário de Brasília. */
export function formatReleaseDeadline(iso: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

export function lateReleaseMessage(validUntil: string): string {
  return `Prova liberada para você até ${formatReleaseDeadline(validUntil)}.`;
}

export const DEADLINE_CLOSED_MESSAGE =
  "O prazo para fazer esta avaliação encerrou. Se você não conseguiu fazer, procure a coordenação para pedir a liberação.";

export const HAD_ATTEMPT_MESSAGE = "Você já fez esta avaliação. Se precisar de ajuda, fale com a coordenação da Escola Makários.";
export const RELEASE_EXPIRED_MESSAGE = "O seu prazo de 24 horas terminou. Fale com a coordenação da Escola Makários.";

export type LateReleaseView =
  | "none" //      o prazo não bloqueia (dentro do prazo, sem prazo, ou liberação ativa)
  | "released" //  prazo vencido e liberação ativa
  | "request" //   prazo vencido, pode pedir a liberação agora
  | "expired" //   já teve liberação e as 24 horas terminaram
  | "had_attempt" // prazo vencido e já tem tentativa: só a coordenação ajuda
  | "closed"; //   prazo vencido e a janela de pedidos não está aberta

/** Ainda dá para iniciar (sobrou tentativa) ou continuar (há uma em andamento)? Mesma conta de start_assessment_attempt. */
export function canStartOrContinue(input: { attemptsUsed: number; attemptsAllowed: number; hasInProgress: boolean }): boolean {
  return input.hasInProgress || input.attemptsUsed < input.attemptsAllowed;
}

/**
 * O que o aluno vê, no mesmo critério de request_late_release (migração 088).
 * Liberação ativa só vale como "released" quando ele ainda pode iniciar ou continuar: quem já usou
 * as tentativas continua em "had_attempt" (a liberação não dá tentativa extra).
 */
export function lateReleaseView(input: {
  closesAt: string | null;
  requestsUntil: string | null;
  releaseValidUntil: string | null;
  attemptsUsed: number;
  /** Quantas tentativas ele tem (1, ou 2 com a tentativa excepcional). Padrão 1. */
  attemptsAllowed?: number;
  hasInProgress?: boolean;
  now?: Date;
}): LateReleaseView {
  const now = input.now ?? new Date();
  if (!isPastDeadline(input.closesAt, now)) return "none";
  const hasInProgress = input.hasInProgress ?? false;
  if (isReleaseActive(input.releaseValidUntil, now)) {
    const canStart = canStartOrContinue({ attemptsUsed: input.attemptsUsed, attemptsAllowed: input.attemptsAllowed ?? 1, hasInProgress });
    return canStart ? "released" : "had_attempt";
  }
  if (input.releaseValidUntil) return "expired";
  if (input.attemptsUsed > 0) return "had_attempt";
  return isReleaseActive(input.requestsUntil, now) ? "request" : "closed";
}

/**
 * Linha pequena sob a avaliação na lista do volume, pela MESMA decisão da página da avaliação e da tela
 * inicial. Quem já fez a prova ("had_attempt") e quem está dentro do prazo ("none") não vê nada.
 */
export function volumeAssessmentNote(view: LateReleaseView, releaseValidUntil: string | null): string | null {
  switch (view) {
    case "released":
      return releaseValidUntil ? lateReleaseMessage(releaseValidUntil) : null;
    case "request":
      return "Prazo encerrado. Toque para pedir a liberação da prova.";
    case "expired":
      return RELEASE_EXPIRED_MESSAGE;
    case "closed":
      return "Prazo encerrado. Procure a coordenação se precisar de liberação.";
    default:
      return null;
  }
}

/** "2026-11-13T23:59", no horário de Brasília, para preencher o campo datetime-local. */
export function toBrasiliaInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
