import { CheckCircle2, CircleDashed, Clock, HelpCircle, XCircle } from "lucide-react";
import { MODULE_STATUS_LABELS, OVERALL_LABELS } from "../eligibility";
import type { ModuleResult, ModuleStatus, OverallStatus, RequirementState } from "../types";
import { Alert } from "@/components/ui/Alert";
import type { GraduationState } from "../guard";

export const OVERALL_STYLE: Record<OverallStatus, string> = {
  apto: "bg-green-50 text-green-700",
  pendente: "bg-amber-50 text-amber-700",
  em_conferencia: "bg-violet-50 text-violet-700",
  nao_apto: "bg-red-50 text-red-700",
  em_andamento: "bg-brand-blue-light text-brand-blue-dark",
};

const MODULE_STYLE: Record<ModuleStatus, string> = {
  concluido: "bg-green-50 text-green-700",
  em_andamento: "bg-brand-blue-light text-brand-blue-dark",
  pendente: "bg-amber-50 text-amber-700",
  em_conferencia: "bg-violet-50 text-violet-700",
  nao_concluido: "bg-red-50 text-red-700",
};

export function OverallBadge({ status }: { status: OverallStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${OVERALL_STYLE[status]}`}>{OVERALL_LABELS[status]}</span>;
}

const MODULE_ICON: Record<ModuleStatus, typeof CheckCircle2> = {
  concluido: CheckCircle2,
  em_andamento: Clock,
  pendente: CircleDashed,
  em_conferencia: HelpCircle,
  nao_concluido: XCircle,
};

/** Ícone discreto do módulo para a tabela; o texto completo fica no tooltip e no leitor de tela. */
export function ModuleDot({ module }: { module: ModuleResult }) {
  const Icon = MODULE_ICON[module.status];
  const label = `${module.label}: ${MODULE_STATUS_LABELS[module.status]}${module.seasonName ? ` (${module.seasonName})` : ""}`;
  return (
    <span title={label} className={`inline-flex size-7 items-center justify-center rounded-full ${MODULE_STYLE[module.status]}`}>
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ModuleBadge({ status }: { status: ModuleStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${MODULE_STYLE[status]}`}>{MODULE_STATUS_LABELS[status]}</span>;
}

export const REQUIREMENT_STYLE: Record<RequirementState, { label: string; className: string }> = {
  cumprido: { label: "Cumprido", className: "bg-green-50 text-green-700" },
  pendente: { label: "Pendente", className: "bg-amber-50 text-amber-700" },
  em_conferencia: { label: "Em conferência", className: "bg-violet-50 text-violet-700" },
  impedimento: { label: "Impedimento", className: "bg-red-50 text-red-700" },
  em_andamento: { label: "Em andamento", className: "bg-brand-blue-light text-brand-blue-dark" },
  aviso: { label: "Aviso", className: "bg-neutral-100 text-neutral-600" },
};

export function FormFeedback({ state }: { state: GraduationState }) {
  if (state.error) return <Alert variant="danger">{state.error}</Alert>;
  if (state.success) return <Alert variant="success">{state.success}</Alert>;
  return null;
}
