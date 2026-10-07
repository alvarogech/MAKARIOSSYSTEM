import Link from "next/link";
import { BookOpen, CalendarDays, Check, ChevronDown, Clock, ListChecks, Sprout } from "lucide-react";
import type { JourneyStage as Stage, JourneyStep, StageState, StepKind, StepState } from "../journey";

const STAGE_LABEL: Record<StageState, string> = {
  concluida: "Concluída",
  em_andamento: "Em andamento",
  disponivel: "Disponível",
  em_breve: "Em breve",
};

const STAGE_BADGE: Record<StageState, string> = {
  concluida: "bg-green-50 text-green-700",
  em_andamento: "bg-amber-50 text-amber-700",
  disponivel: "bg-brand-blue-light text-brand-blue",
  em_breve: "bg-neutral-100 text-neutral-600",
};

const STEP_ICON: Record<StepKind, typeof BookOpen> = {
  aula: CalendarDays,
  material: BookOpen,
  fixacao: ListChecks,
  pratica: Sprout,
};

const STEP_STATE_LABEL: Record<StepState, string> = {
  feito: "feito",
  em_andamento: "em andamento",
  pendente: "a fazer",
  indisponivel: "ainda não disponível",
};

const AULA_STATE_LABEL: Record<StepState, string> = {
  feito: "presente",
  em_andamento: "em andamento",
  pendente: "sem presença registrada",
  indisponivel: "em breve",
};

const dateLabel = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

function Step({ step }: { step: JourneyStep }) {
  const Icon = STEP_ICON[step.kind];
  const body = (
    <span className="flex min-w-0 items-start gap-2.5">
      <Icon className={`mt-0.5 size-4 shrink-0 ${step.state === "feito" ? "text-success" : "text-neutral-400"}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-900">
          {step.label} <span className="font-normal text-neutral-500">· {(step.kind === "aula" ? AULA_STATE_LABEL : STEP_STATE_LABEL)[step.state]}</span>
        </span>
        {step.detail ? <span className="block text-xs text-neutral-500">{step.detail}</span> : null}
      </span>
    </span>
  );
  return step.href && step.state !== "indisponivel" ? (
    <Link
      href={step.href}
      className="block rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors hover:bg-brand-blue-light motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-brand-blue"
    >
      {body}
    </Link>
  ) : (
    <div className="px-2 py-1.5">{body}</div>
  );
}

/** Uma etapa do caminho (uma matéria). A etapa em foco chega aberta; as outras podem ser abertas por teclado ou toque. */
export function JourneyStage({ stage, current }: { stage: Stage; current: boolean }) {
  const summary =
    stage.actionsTotal > 0 ? `${stage.actionsDone} de ${stage.actionsTotal} ${stage.actionsTotal === 1 ? "atividade" : "atividades"}` : stage.date ? dateLabel(stage.date) : "";

  return (
    <li className="relative pl-12" aria-current={current ? "step" : undefined}>
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1 flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold ${
          stage.state === "concluida"
            ? "border-success bg-success text-white"
            : current
              ? "border-brand-blue bg-brand-blue text-white"
              : "border-neutral-300 bg-white text-neutral-500"
        }`}
      >
        {stage.state === "concluida" ? <Check className="size-4" /> : stage.state === "em_breve" && !current ? <Clock className="size-4" /> : stage.number}
      </span>

      <details open={current} className="group rounded-[var(--radius-lg)] border border-neutral-200 bg-white">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] px-4 py-3 focus-visible:outline-2 focus-visible:outline-brand-blue [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-xs text-neutral-500">Etapa {stage.number}</span>
            <span className="block font-semibold text-neutral-900">{stage.name}</span>
          </span>
          <span className="flex items-center gap-2">
            {summary ? <span className="text-xs text-neutral-500">{summary}</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[stage.state]}`}>{STAGE_LABEL[stage.state]}</span>
            <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </span>
        </summary>
        <div className="flex flex-col gap-0.5 border-t border-neutral-100 px-2 py-2">
          {stage.steps.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-neutral-500">Ainda não há atividades nesta etapa. Quando houver, aparecem aqui.</p>
          ) : (
            stage.steps.map((step) => <Step key={step.kind} step={step} />)
          )}
        </div>
      </details>
    </li>
  );
}
