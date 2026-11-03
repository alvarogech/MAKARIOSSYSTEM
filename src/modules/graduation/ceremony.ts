import type { OverallStatus } from "./types";

/** Estados da ORGANIZAÇÃO da edição (não da aprovação do aluno). */
export const EDITION_STATUSES = [
  "em_preparacao",
  "regularizacao",
  "confirmacoes_abertas",
  "confirmacoes_encerradas",
  "realizada",
  "arquivada",
] as const;
export type EditionStatus = (typeof EDITION_STATUSES)[number];

export const EDITION_STATUS_LABELS: Record<EditionStatus, string> = {
  em_preparacao: "Em preparação",
  regularizacao: "Regularização acadêmica",
  confirmacoes_abertas: "Confirmações abertas",
  confirmacoes_encerradas: "Confirmações encerradas",
  realizada: "Cerimônia realizada",
  arquivada: "Arquivada",
};

export interface CeremonyFields {
  eventName: string | null;
  eventDate: string | null;
  eventTime: string | null;
  locationName: string | null;
  address: string | null;
  rsvpDeadline: string | null;
}

const REQUIRED: { key: keyof CeremonyFields; label: string }[] = [
  { key: "eventName", label: "nome do evento" },
  { key: "eventDate", label: "data" },
  { key: "eventTime", label: "horário" },
  { key: "locationName", label: "local" },
  { key: "address", label: "endereço" },
  { key: "rsvpDeadline", label: "prazo para confirmação" },
];

/** Campos que faltam antes de publicar. Sem eles, nada é mostrado ao aluno (nunca há data inventada). */
export function missingPublishFields(fields: CeremonyFields): string[] {
  return REQUIRED.filter(({ key }) => !fields[key]?.toString().trim()).map(({ label }) => label);
}

export type RsvpWindow = "nao_publicada" | "aberta" | "prazo_encerrado" | "encerrada";

/** A confirmação só existe depois de publicada, com as confirmações abertas e dentro do prazo. */
export function rsvpWindow(
  edition: { status: EditionStatus; publishedAt: string | null; rsvpDeadline: string | null },
  now: Date,
): RsvpWindow {
  if (!edition.publishedAt) return "nao_publicada";
  if (edition.status !== "confirmacoes_abertas") return edition.status === "em_preparacao" || edition.status === "regularizacao" ? "nao_publicada" : "encerrada";
  if (edition.rsvpDeadline && now.getTime() > new Date(edition.rsvpDeadline).getTime()) return "prazo_encerrado";
  return "aberta";
}

/** Mudou algo que quem já confirmou precisa saber? (data, horário, local ou endereço) */
export function materialChanges(previous: CeremonyFields, next: CeremonyFields): string[] {
  const fields: { key: keyof CeremonyFields; label: string }[] = [
    { key: "eventDate", label: "data" },
    { key: "eventTime", label: "horário" },
    { key: "locationName", label: "local" },
    { key: "address", label: "endereço" },
  ];
  return fields.filter(({ key }) => (previous[key] ?? "") !== (next[key] ?? "")).map(({ label }) => label);
}

export interface InviteConflict {
  studentId: string;
  /** O que mudou desde o convite. */
  currentStatus: OverallStatus;
  response: string;
}

/**
 * Convidados que deixaram de estar aptos depois do convite (um registro
 * acadêmico foi alterado). O convite não some sozinho: a coordenação decide.
 */
export function inviteConflicts(
  participants: { studentId: string; invitedAt: string | null; invitedStatus: string | null; response: string }[],
  currentStatus: ReadonlyMap<string, OverallStatus>,
): InviteConflict[] {
  const conflicts: InviteConflict[] = [];
  for (const p of participants) {
    if (!p.invitedAt || p.invitedStatus !== "apto") continue;
    const now = currentStatus.get(p.studentId);
    if (now && now !== "apto") conflicts.push({ studentId: p.studentId, currentStatus: now, response: p.response });
  }
  return conflicts;
}

export interface CeremonyStats {
  invited: number;
  confirmed: number;
  declined: number;
  awaiting: number;
  recordedByCoordination: number;
  confirmedIncomplete: number;
}

export interface CeremonyParticipant {
  invitedAt: string | null;
  response: "sem_resposta" | "confirmado" | "nao_comparece";
  responseSource: "aluno" | "coordenacao" | null;
  /** Falta algo para a lista final/certificado (telefone, nome conferido...). */
  incomplete: boolean;
}

export function ceremonyStats(participants: CeremonyParticipant[]): CeremonyStats {
  const invited = participants.filter((p) => p.invitedAt);
  return {
    invited: invited.length,
    confirmed: invited.filter((p) => p.response === "confirmado").length,
    declined: invited.filter((p) => p.response === "nao_comparece").length,
    awaiting: invited.filter((p) => p.response === "sem_resposta").length,
    recordedByCoordination: invited.filter((p) => p.response !== "sem_resposta" && p.responseSource === "coordenacao").length,
    confirmedIncomplete: invited.filter((p) => p.response === "confirmado" && p.incomplete).length,
  };
}
