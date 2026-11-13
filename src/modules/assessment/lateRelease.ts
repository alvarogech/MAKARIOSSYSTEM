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
