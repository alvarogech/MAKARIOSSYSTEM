/**
 * Jornada do aluno: transforma o que já existe (aula ao vivo, material, exercício de fixação, prática)
 * numa sequência de etapas por matéria. É só leitura — nenhuma regra acadêmica mora aqui:
 * liberação, tentativas, prazos e notas continuam nas telas e funções de origem.
 */

export type StepKind = "aula" | "material" | "fixacao" | "pratica";
export type StepState = "feito" | "em_andamento" | "pendente" | "indisponivel";
export type StageState = "concluida" | "em_andamento" | "disponivel" | "em_breve";

export interface JourneyStep {
  kind: StepKind;
  label: string;
  state: StepState;
  detail: string | null;
  href: string | null;
}

export interface JourneyStage {
  moduleId: string;
  name: string;
  number: number;
  state: StageState;
  /** Data do encontro em que a matéria é dada (yyyy-mm-dd), se houver. */
  date: string | null;
  steps: JourneyStep[];
  /** Quantas ações o aluno pode fazer nesta etapa (material, fixação, prática) e quantas já fez. */
  actionsDone: number;
  actionsTotal: number;
}

export interface StageInput {
  moduleId: string;
  name: string;
  meeting: { date: string; past: boolean; attendance: "presente" | "sem_registro" | "futuro" } | null;
  material: { total: number; released: number; completed: number };
  fixation: { activityId: string; status: "nenhuma" | "em_andamento" | "enviada" } | null;
  practice: { done: boolean } | null;
}

export interface JourneyNextStep {
  stageName: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

export interface VolumeJourney {
  enrollmentId: string;
  volumeName: string;
  stages: JourneyStage[];
  concluded: number;
  /** Índice da etapa em foco (primeira com algo a fazer ou, na falta, a próxima aula). -1 se tudo concluído. */
  currentIndex: number;
  next: JourneyNextStep | null;
}

const dateLabel = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

function buildSteps(input: StageInput, enrollmentId: string): JourneyStep[] {
  const steps: JourneyStep[] = [];

  if (input.meeting) {
    const { date, past, attendance } = input.meeting;
    steps.push({
      kind: "aula",
      label: "Aula ao vivo",
      state: past ? (attendance === "presente" ? "feito" : "pendente") : "indisponivel",
      detail: past
        ? attendance === "presente"
          ? `Presença registrada em ${dateLabel(date)}`
          : `Encontro de ${dateLabel(date)} sem presença registrada`
        : `Acontece em ${dateLabel(date)}`,
      href: past && attendance !== "presente" ? "/minha-frequencia" : null,
    });
  }

  if (input.material.total > 0) {
    const { total, released, completed } = input.material;
    steps.push({
      kind: "material",
      label: "Material de estudo",
      state: completed >= total ? "feito" : released === 0 ? "indisponivel" : completed > 0 ? "em_andamento" : "pendente",
      detail:
        released === 0 ? "Ainda não liberado" : `${completed} de ${total} ${total === 1 ? "item concluído" : "itens concluídos"}`,
      href: released > 0 ? `/meus-volumes/${enrollmentId}` : null,
    });
  }

  if (input.fixation) {
    const { activityId, status } = input.fixation;
    steps.push({
      kind: "fixacao",
      label: "Exercício de fixação",
      state: status === "enviada" ? "feito" : status === "em_andamento" ? "em_andamento" : "pendente",
      detail: status === "enviada" ? "Concluído — você pode rever ou repetir" : status === "em_andamento" ? "Você já começou" : "Cinco questões, uma por vez",
      href: `/exercicios/${activityId}?enrollmentId=${enrollmentId}`,
    });
  }

  if (input.practice) {
    steps.push({
      kind: "pratica",
      label: "Prática",
      state: input.practice.done ? "feito" : "pendente",
      detail: input.practice.done ? "Prática registrada" : "Um desafio para viver o que aprendeu",
      href: "/meu-aprendizado",
    });
  }

  return steps;
}

export function buildStage(input: StageInput, number: number, enrollmentId: string): JourneyStage {
  const steps = buildSteps(input, enrollmentId);
  // Só material, fixação e prática são "ações" do aluno; a aula ao vivo é contexto.
  const actions = steps.filter((s) => s.kind !== "aula" && s.state !== "indisponivel");
  const actionsDone = actions.filter((s) => s.state === "feito").length;

  let state: StageState;
  if (actions.length === 0) {
    state = input.meeting?.past ? "concluida" : "em_breve";
  } else if (actionsDone === actions.length) {
    state = "concluida";
  } else if (actionsDone > 0 || actions.some((s) => s.state === "em_andamento")) {
    state = "em_andamento";
  } else {
    state = "disponivel";
  }

  return {
    moduleId: input.moduleId,
    name: input.name,
    number,
    state,
    date: input.meeting?.date ?? null,
    steps,
    actionsDone,
    actionsTotal: actions.length,
  };
}

/** Próxima ação sugerida dentro de uma etapa: continuar o que está em andamento, senão o primeiro pendente. */
function nextAction(stage: JourneyStage): JourneyNextStep | null {
  const actions = stage.steps.filter((s) => s.kind !== "aula" && s.href && s.state !== "feito" && s.state !== "indisponivel");
  const pick = actions.find((s) => s.state === "em_andamento") ?? actions[0];
  if (!pick || !pick.href) return null;
  const verb: Record<StepKind, string> = {
    aula: "Ver",
    material: "Estudar o material de",
    fixacao: pick.state === "em_andamento" ? "Continuar o exercício de" : "Fazer o exercício de fixação de",
    pratica: "Registrar a prática de",
  };
  return {
    stageName: stage.name,
    title: `${verb[pick.kind]} ${stage.name}`,
    detail: pick.detail ?? "",
    href: pick.href,
    cta: pick.state === "em_andamento" ? "Continuar" : "Começar",
  };
}

export function buildVolumeJourney(args: {
  enrollmentId: string;
  volumeName: string;
  stages: StageInput[];
}): VolumeJourney {
  const stages = args.stages.map((input, index) => buildStage(input, index + 1, args.enrollmentId));
  const concluded = stages.filter((s) => s.state === "concluida").length;

  let currentIndex = stages.findIndex((s) => s.state === "em_andamento" || s.state === "disponivel");
  if (currentIndex === -1) currentIndex = stages.findIndex((s) => s.state === "em_breve");

  const current = currentIndex >= 0 ? stages[currentIndex] : undefined;
  const next = current ? nextAction(current) : null;

  return { enrollmentId: args.enrollmentId, volumeName: args.volumeName, stages, concluded, currentIndex, next };
}
