import type { PersonStat } from "@/modules/attendance/overview";
import type { Situation } from "@/modules/attendance/progress";

/** Funil único do aluno: inscrito → aprovado → conta criada → matriculado → frequentando → em risco → concluído / não aprovado. */
export type FunnelStage =
  | "inscrito"
  | "aprovado"
  | "conta_criada"
  | "matriculado"
  | "frequentando"
  | "em_risco"
  | "concluido"
  | "nao_aprovado"
  | "encerrada";

export const FUNNEL_ORDER: FunnelStage[] = [
  "inscrito",
  "aprovado",
  "conta_criada",
  "matriculado",
  "frequentando",
  "em_risco",
  "concluido",
  "nao_aprovado",
  "encerrada",
];

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  inscrito: "Inscrito (aguardando decisão)",
  aprovado: "Aprovado (sem conta)",
  conta_criada: "Conta criada (nunca entrou)",
  matriculado: "Matriculado (ainda sem presença)",
  frequentando: "Frequentando",
  em_risco: "Em risco de frequência",
  concluido: "Concluído",
  nao_aprovado: "Não aprovado",
  encerrada: "Inscrição recusada/cancelada",
};

export const FUNNEL_STYLE: Record<FunnelStage, string> = {
  inscrito: "bg-neutral-100 text-neutral-700",
  aprovado: "bg-red-50 text-red-700",
  conta_criada: "bg-orange-50 text-orange-700",
  matriculado: "bg-amber-50 text-amber-700",
  frequentando: "bg-green-50 text-green-700",
  em_risco: "bg-red-100 text-red-800",
  concluido: "bg-brand-blue-light text-brand-blue",
  nao_aprovado: "bg-neutral-200 text-neutral-700",
  encerrada: "bg-neutral-100 text-neutral-400",
};

export interface FunnelInput {
  requestStatus: string;
  hasAccount: boolean;
  lastSignInAt: string | null;
  /** Status das matrículas da pessoa (active, approved, failed...). */
  enrollmentStatuses: string[];
  /** Pior situação de frequência entre as turmas dela; null se ainda não há encontro realizado/turma. */
  situation: Situation | null;
  attendedMinutes: number;
}

/** A etapa em que a pessoa está HOJE (a mais avançada que ela alcançou, com risco prevalecendo sobre "frequentando"). */
export function stageOf(input: FunnelInput): FunnelStage {
  if (input.requestStatus === "pending") return "inscrito";
  if (input.requestStatus !== "approved") return "encerrada";
  if (!input.hasAccount) return "aprovado";

  const statuses = input.enrollmentStatuses;
  if (statuses.length > 0 && statuses.every((s) => s === "approved")) return "concluido";
  if (statuses.some((s) => s === "failed")) return "nao_aprovado";

  if (input.situation === "reprovado" || input.situation === "no_limite") return "em_risco";
  if (input.attendedMinutes > 0) return "frequentando";
  if (input.lastSignInAt || statuses.length > 0) return statuses.length > 0 ? "matriculado" : "conta_criada";
  return "conta_criada";
}

const WORST: Situation[] = ["reprovado", "no_limite", "atencao", "em_dia"];

/** Junta as situações das várias turmas da mesma pessoa na pior. */
export function worstSituation(people: Pick<PersonStat, "progress">[]): Situation | null {
  if (people.length === 0) return null;
  const present = people.map((p) => p.progress.situation);
  return WORST.find((s) => present.includes(s)) ?? null;
}
