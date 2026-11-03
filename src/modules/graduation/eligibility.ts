import {
  MODULES,
  MODULE_LABELS,
  type AssessmentFact,
  type AttendanceFact,
  type Evaluation,
  type EnrollmentFact,
  type EvaluationContext,
  type EvidenceOrigin,
  type ModuleResult,
  type ModuleSlug,
  type ModuleStatus,
  type OverallStatus,
  type PendencyCategory,
  type Requirement,
  type RequirementState,
  type StudentFacts,
} from "./types";

/**
 * Motor de elegibilidade da formatura. Função pura: recebe os fatos já
 * carregados e devolve o resultado, sem ler banco nem conhecer tela. Toda
 * regra de "apto" mora aqui — nenhum componente decide isso por conta própria.
 *
 * Regras acadêmicas reaproveitadas do sistema (nada foi inventado aqui):
 *  - frequência mínima de 75%: `MIN_ATTENDANCE_RATIO` (via `computeProgress`, já
 *    calculada no carregador e entregue em `AttendanceFact.situation`);
 *  - nota mínima: `assessments.passing_grade` de cada avaliação;
 *  - a nota do aluno é a maior entre avaliação final e recuperação
 *    (`resolveFinalGrade`, doc 02 §8);
 *  - "módulo concluído" = matrícula com status `approved` (a mesma noção que
 *    o pré-requisito de matrícula já usa) ou histórico validado por
 *    administrador, ou, na falta dos dois, frequência e nota comprovadas na
 *    própria plataforma.
 *
 * Ausência de dado nunca vira reprovação: vira "em conferência".
 */

const NOT_COUNTED = new Set(["canceled", "withdrawn"]);

const CONCLUSION_CATEGORY: Record<ModuleSlug, PendencyCategory> = {
  essencia: "conclusao_essencia",
  caminho: "conclusao_caminho",
  voz: "conclusao_voz",
};

const fmtGrade = (n: number) => n.toFixed(1).replace(".", ",");
const fmtPct = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")}%`;
const dateOf = (iso: string) => iso.slice(0, 10);

function attendancePercent(a: AttendanceFact): number | null {
  const base = a.allMeetingsPast ? a.totalMinutes : a.attendedMinutes + a.missedMinutes;
  return base > 0 ? Math.round((a.attendedMinutes / base) * 1000) / 10 : null;
}

function bestScore(...assessments: (AssessmentFact | null)[]): number | null {
  let best: number | null = null;
  for (const assessment of assessments) {
    for (const attempt of assessment?.attempts ?? []) {
      if ((attempt.status === "submitted" || attempt.status === "expired") && attempt.score !== null) {
        best = best === null ? attempt.score : Math.max(best, attempt.score);
      }
    }
  }
  return best;
}

interface PartialRequirement {
  kind: "frequencia" | "avaliacao" | "conclusao" | "matricula";
  title: string;
  state: RequirementState;
  reason: string;
  guidance: string;
  actionLabel?: string;
  actionHref?: string;
}

function toRequirement(module: ModuleSlug, partial: PartialRequirement, category: PendencyCategory): Requirement {
  return {
    key: `${module}:${partial.kind}`,
    module,
    category,
    title: partial.title,
    state: partial.state,
    blocking: partial.state !== "aviso",
    reason: partial.reason,
    guidance: partial.guidance,
    action: partial.actionLabel && partial.actionHref ? { label: partial.actionLabel, href: partial.actionHref } : null,
  };
}

function evaluateAttendance(
  module: ModuleSlug,
  enrollment: EnrollmentFact,
  facts: StudentFacts,
  fichaHref: string,
): PartialRequirement {
  const label = MODULE_LABELS[module];
  const title = `Frequência de ${label}`;
  const attendance = enrollment.attendance;

  if (!attendance || attendance.totalMinutes === 0) {
    return {
      kind: "frequencia",
      title,
      state: "em_conferencia",
      reason: `Não há encontros ou presenças registrados para a turma de ${label} (${enrollment.className}).`,
      guidance: "Conferir se a turma tem encontros cadastrados e se a chamada foi lançada.",
      actionLabel: "Abrir ficha do aluno",
      actionHref: fichaHref,
    };
  }

  const pct = attendancePercent(attendance);
  const pctText = pct === null ? "sem encontros realizados" : fmtPct(pct);

  if (attendance.situation !== "reprovado") {
    if (attendance.allMeetingsPast) {
      return {
        kind: "frequencia",
        title,
        state: "cumprido",
        reason: `Presença de ${pctText} em ${label}, dentro do mínimo exigido (75%).`,
        guidance: "",
      };
    }
    return {
      kind: "frequencia",
      title,
      state: "em_andamento",
      reason: `Presença de ${pctText} até agora em ${label}; ainda há encontros por acontecer.`,
      guidance: "Acompanhar os próximos encontros.",
    };
  }

  // Abaixo do mínimo.
  const base = `Frequência de ${label} abaixo do mínimo exigido (75%): ${pctText}.`;
  if (enrollment.status === "failed") {
    return {
      kind: "frequencia",
      title,
      state: "impedimento",
      reason: `${base} A matrícula consta como não aprovada.`,
      guidance: "Só uma nova decisão da coordenação sobre a matrícula reabre este caminho.",
      actionLabel: "Abrir ficha do aluno",
      actionHref: fichaHref,
    };
  }
  if (facts.pendingJustifications > 0) {
    return {
      kind: "frequencia",
      title,
      state: "em_conferencia",
      reason: `${base} Há ${facts.pendingJustifications} pedido(s) de presença ou autodeclaração aguardando análise.`,
      guidance: "Analisar os pedidos pendentes; o resultado só é definitivo depois da decisão.",
      actionLabel: "Analisar pedidos de presença",
      actionHref: "/coordenacao/presenca",
    };
  }
  return {
    kind: "frequencia",
    title,
    state: "pendente",
    reason: base,
    guidance: "Conferir lançamentos, justificativas e as regras de reposição antes de contatar o aluno.",
    actionLabel: "Abrir ficha do aluno",
    actionHref: fichaHref,
  };
}

function evaluateAssessment(
  module: ModuleSlug,
  enrollment: EnrollmentFact,
  fichaHref: string,
  now: Date,
): { requirement: PartialRequirement; grade: number | null; passingGrade: number | null; passedAt: string | null } {
  const label = MODULE_LABELS[module];
  const title = `Avaliação final de ${label}`;
  const final = enrollment.finalAssessment;
  const recovery = enrollment.recoveryAssessment;

  if (!final) {
    return {
      requirement: {
        kind: "avaliacao",
        title,
        state: "em_conferencia",
        reason: `Não há avaliação final cadastrada para ${label} em ${enrollment.seasonName}.`,
        guidance: "Conferir a oferta do módulo na temporada.",
      },
      grade: null,
      passingGrade: null,
      passedAt: null,
    };
  }

  const passingGrade = final.passingGrade;
  const attempts = [...final.attempts, ...(recovery?.attempts ?? [])];
  const best = bestScore(final, recovery) ?? (attempts.length === 0 ? enrollment.finalGrade : null);

  if (best !== null && best >= passingGrade) {
    const passingAttempt = attempts
      .filter((a) => a.score !== null && a.score >= passingGrade && a.submittedAt)
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))[0];
    return {
      requirement: {
        kind: "avaliacao",
        title,
        state: "cumprido",
        reason: `Nota ${fmtGrade(best)} (mínimo ${fmtGrade(passingGrade)}).`,
        guidance: "",
      },
      grade: best,
      passingGrade,
      passedAt: passingAttempt?.submittedAt ?? null,
    };
  }

  const inProgress = attempts.find((a) => a.status === "in_progress");
  if (inProgress) {
    const expired = inProgress.deadlineAt !== null && new Date(inProgress.deadlineAt).getTime() < now.getTime();
    return {
      requirement: expired
        ? {
            kind: "avaliacao",
            title,
            state: "em_conferencia",
            reason: "Há uma tentativa iniciada cujo prazo já passou e ainda não foi encerrada pelo sistema.",
            guidance: "Aguardar o encerramento automático da tentativa e reverificar em seguida.",
          }
        : {
            kind: "avaliacao",
            title,
            state: "em_andamento",
            reason: "O aluno está com uma tentativa em andamento.",
            guidance: "O resultado sai assim que a tentativa for enviada.",
          },
      grade: best,
      passingGrade,
      passedAt: null,
    };
  }

  const submitted = attempts.filter((a) => (a.status === "submitted" || a.status === "expired") && a.score !== null);
  if (submitted.length > 0 && best !== null) {
    const recoveryUsed = (recovery?.attempts ?? []).some((a) => a.status === "submitted" || a.status === "expired");
    const recoveryAvailable = !!recovery && !recoveryUsed && recovery.status !== "closed";
    const base = `Nota ${fmtGrade(best)}, abaixo do mínimo de ${fmtGrade(passingGrade)}.`;
    if (recoveryAvailable || final.extraAttemptGranted) {
      return {
        requirement: {
          kind: "avaliacao",
          title,
          state: "pendente",
          reason: base,
          guidance: recoveryAvailable
            ? recovery!.status === "open"
              ? "A recuperação está aberta: orientar o aluno a fazê-la."
              : "A recuperação ainda não foi aberta: abri-la para os alunos abaixo da nota."
            : "Há tentativa excepcional autorizada: orientar o aluno a refazer a avaliação.",
          actionLabel: "Abrir ficha do aluno",
          actionHref: fichaHref,
        },
        grade: best,
        passingGrade,
        passedAt: null,
      };
    }
    return {
      requirement: {
        kind: "avaliacao",
        title,
        state: enrollment.status === "failed" || recoveryUsed ? "impedimento" : "pendente",
        reason: `${base} ${recoveryUsed ? "A recuperação já foi realizada." : "Não há recuperação disponível."}`,
        guidance:
          enrollment.status === "failed" || recoveryUsed
            ? "Só uma tentativa excepcional autorizada pela coordenação reabre este caminho."
            : "Avaliar a abertura de recuperação ou de tentativa excepcional.",
        actionLabel: "Abrir ficha do aluno",
        actionHref: fichaHref,
      },
      grade: best,
      passingGrade,
      passedAt: null,
    };
  }

  // Nenhuma tentativa concluída.
  const deadline = final.closesAt ? ` Prazo: ${new Date(final.closesAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : "";
  if (final.status === "draft") {
    return {
      requirement: {
        kind: "avaliacao",
        title,
        state: "em_andamento",
        reason: "A avaliação final ainda não foi aberta aos alunos.",
        guidance: "Aguardar a abertura da avaliação.",
      },
      grade: null,
      passingGrade,
      passedAt: null,
    };
  }
  if (final.status === "open") {
    return {
      requirement: {
        kind: "avaliacao",
        title,
        state: "pendente",
        reason: final.eligible
          ? `O aluno ainda não realizou a avaliação final de ${label}.${deadline}`
          : `O aluno ainda não realizou a avaliação final de ${label} e não consta na lista de liberados para fazê-la.`,
        guidance: final.eligible
          ? "Orientar o aluno a acessar a plataforma e fazer a avaliação."
          : "Conferir por que o aluno não foi liberado (frequência ou regularização) antes de orientá-lo.",
        actionLabel: "Abrir ficha do aluno",
        actionHref: fichaHref,
      },
      grade: null,
      passingGrade,
      passedAt: null,
    };
  }
  return {
    requirement: {
      kind: "avaliacao",
      title,
      state: "pendente",
      reason: `O prazo da avaliação final de ${label} encerrou sem tentativa do aluno.`,
      guidance: "Só é possível regularizar com tentativa excepcional autorizada pela coordenação.",
      actionLabel: "Abrir ficha do aluno",
      actionHref: fichaHref,
    },
    grade: null,
    passingGrade,
    passedAt: null,
  };
}

function statusFromRequirements(requirements: Requirement[]): ModuleStatus {
  const open = requirements.filter((r) => r.blocking && r.state !== "cumprido");
  if (open.some((r) => r.state === "impedimento")) return "nao_concluido";
  if (open.some((r) => r.state === "pendente")) return "pendente";
  if (open.some((r) => r.state === "em_conferencia")) return "em_conferencia";
  if (open.some((r) => r.state === "em_andamento")) return "em_andamento";
  return "concluido";
}

/** A matrícula mais relevante do módulo: concluída primeiro, depois a mais recente. Canceladas e trancadas não contam. */
function pickEnrollments(facts: StudentFacts, module: ModuleSlug): EnrollmentFact[] {
  return facts.enrollments
    .filter((e) => e.volume === module && !NOT_COUNTED.has(e.status))
    .sort((a, b) => {
      if ((a.status === "approved") !== (b.status === "approved")) return a.status === "approved" ? -1 : 1;
      return b.seasonStartsOn.localeCompare(a.seasonStartsOn);
    });
}

function evaluateModule(module: ModuleSlug, facts: StudentFacts, now: Date): { result: ModuleResult; requirements: Requirement[] } {
  const label = MODULE_LABELS[module];
  const category = CONCLUSION_CATEGORY[module];
  const fichaHref = facts.requestId ? `/coordenacao/alunos/${facts.requestId}` : "/coordenacao/alunos";
  const enrollments = pickEnrollments(facts, module);
  const base = { slug: module, label } as const;

  // 1. Matrícula marcada como concluída (mesma noção usada nos pré-requisitos).
  const approved = enrollments.find((e) => e.status === "approved");
  if (approved) {
    return {
      result: {
        ...base,
        status: "concluido",
        origin: "matricula_concluida",
        seasonName: approved.seasonName,
        className: approved.className,
        completedOn: dateOf(approved.updatedAt),
        attendance: approved.attendance,
        grade: approved.finalGrade,
        passingGrade: approved.finalAssessment?.passingGrade ?? null,
        note: `Concluído em ${approved.seasonName}.`,
      },
      requirements: [
        toRequirement(module, { kind: "conclusao", title: `Conclusão de ${label}`, state: "cumprido", reason: `Matrícula concluída em ${approved.seasonName}.`, guidance: "" }, category),
      ],
    };
  }

  // 2. Histórico validado por administrador.
  const history = facts.history.find((h) => h.volume === module);
  if (history) {
    return {
      result: {
        ...base,
        status: "concluido",
        origin: "historico_validado",
        seasonName: history.seasonLabel,
        className: null,
        completedOn: null,
        attendance: null,
        grade: null,
        passingGrade: null,
        note: `Histórico validado${history.seasonLabel ? ` (${history.seasonLabel})` : ""}: ${history.origin}.`,
      },
      requirements: [
        toRequirement(module, { kind: "conclusao", title: `Conclusão de ${label}`, state: "cumprido", reason: `Histórico validado (${history.origin}).`, guidance: "" }, category),
      ],
    };
  }

  // 3. Dados da plataforma: frequência e nota.
  if (enrollments.length > 0) {
    let chosen: { enrollment: EnrollmentFact; requirements: Requirement[]; grade: number | null; passingGrade: number | null; passedAt: string | null } | null = null;
    for (const enrollment of enrollments) {
      const attendance = evaluateAttendance(module, enrollment, facts, fichaHref);
      const assessment = evaluateAssessment(module, enrollment, fichaHref, now);
      const requirements = [
        toRequirement(module, attendance, "frequencia"),
        toRequirement(module, assessment.requirement, "avaliacao"),
      ];
      if (enrollment.status === "regularization") {
        requirements.push(
          toRequirement(
            module,
            {
              kind: "matricula",
              title: `Matrícula de ${label} em regularização`,
              state: "aviso",
              reason: "A matrícula consta em regularização de frequência.",
              guidance: "Conferir se a regularização já foi concluída.",
            },
            "outras",
          ),
        );
      }
      const candidate = { enrollment, requirements, grade: assessment.grade, passingGrade: assessment.passingGrade, passedAt: assessment.passedAt };
      if (!chosen) chosen = candidate;
      if (statusFromRequirements(requirements) === "concluido") {
        chosen = candidate;
        break;
      }
    }
    const { enrollment, requirements, grade, passingGrade, passedAt } = chosen!;
    const status = statusFromRequirements(requirements);
    const lastMeeting = enrollment.attendance?.lastMeetingDate ?? null;
    const completedOn =
      status === "concluido" ? [passedAt ? dateOf(passedAt) : null, lastMeeting].filter((d): d is string => !!d).sort().at(-1) ?? null : null;
    const conclusion: Requirement =
      status === "concluido"
        ? toRequirement(module, { kind: "conclusao", title: `Conclusão de ${label}`, state: "cumprido", reason: `Frequência e nota comprovadas em ${enrollment.seasonName}.`, guidance: "" }, category)
        : toRequirement(
            module,
            {
              kind: "conclusao",
              title: `Conclusão de ${label}`,
              state: status === "nao_concluido" ? "impedimento" : status === "pendente" ? "pendente" : status === "em_conferencia" ? "em_conferencia" : "em_andamento",
              reason: `${label} ainda não está concluído em ${enrollment.seasonName}: veja frequência e avaliação.`,
              guidance: "A conclusão acontece sozinha quando frequência e nota estiverem cumpridas.",
            },
            category,
          );
    // A conclusão é consequência: não conta como pendência própria (as causas já estão listadas).
    const conclusionNonBlocking: Requirement = status === "concluido" ? conclusion : { ...conclusion, blocking: false };
    return {
      result: {
        ...base,
        status,
        origin: status === "concluido" ? "plataforma" : "sem_evidencia",
        seasonName: enrollment.seasonName,
        className: enrollment.className,
        completedOn,
        attendance: enrollment.attendance,
        grade,
        passingGrade,
        note:
          status === "concluido"
            ? `Concluído em ${enrollment.seasonName}, comprovado por frequência e nota na plataforma.`
            : `Cursando ou com pendências em ${enrollment.seasonName}.`,
      },
      requirements: [conclusionNonBlocking, ...requirements],
    };
  }

  // 4. Nada comprova: conferência. A declaração da inscrição é pista, não prova.
  const hint = facts.prerequisiteNote ? ` Na inscrição o aluno escreveu: “${facts.prerequisiteNote.replace(/\s+/g, " ").trim()}” (declaração do aluno, não comprova a conclusão).` : "";
  return {
    result: {
      ...base,
      status: "em_conferencia",
      origin: "sem_evidencia",
      seasonName: null,
      className: null,
      completedOn: null,
      attendance: null,
      grade: null,
      passingGrade: null,
      note: "Nenhum registro confiável de conclusão.",
    },
    requirements: [
      toRequirement(
        module,
        {
          kind: "conclusao",
          title: `Conclusão de ${label}`,
          state: "em_conferencia",
          reason: `Não há matrícula concluída, nota ou histórico validado de ${label} para este aluno.${hint}`,
          guidance: `Procurar o registro de ${label} em temporadas anteriores. Havendo comprovação, registrar o histórico validado; sem ela, o módulo segue em conferência.`,
          actionLabel: "Registrar histórico validado",
          actionHref: `/coordenacao/formatura/${facts.studentId}#historico`,
        },
        // Com declaração escrita mas sem prova, é questão de histórico; sem nenhuma pista, é conclusão não encontrada.
        facts.prerequisiteNote && module !== "voz" ? "historico" : category,
      ),
    ],
  };
}

function cadastralRequirements(facts: StudentFacts): Requirement[] {
  const requirements: Requirement[] = [];
  if (facts.suspectedDuplicates.length > 0) {
    const names = facts.suspectedDuplicates.map((d) => `${d.name} (${d.reason})`).join("; ");
    requirements.push({
      key: "cadastro:duplicado",
      module: null,
      category: "inconsistencia_cadastral",
      title: "Possível cadastro duplicado",
      state: "em_conferencia",
      blocking: true,
      reason: `Pode haver outro cadastro da mesma pessoa: ${names}. Parte do histórico pode estar no outro cadastro.`,
      guidance: "Conferir os dois cadastros. Nunca mesclar por semelhança de nome; só a coordenação decide, com CPF ou outra prova.",
      action: null,
    });
  }
  if (facts.fullName.trim().split(/\s+/).length < 2) {
    requirements.push({
      key: "cadastro:nome",
      module: null,
      category: "inconsistencia_cadastral",
      title: "Nome possivelmente incompleto",
      state: "aviso",
      blocking: false,
      reason: `O nome cadastrado (“${facts.fullName}”) tem uma só palavra.`,
      guidance: "Confirmar o nome completo antes de imprimir o certificado.",
      action: null,
    });
  }
  if (!facts.phone) {
    requirements.push({
      key: "cadastro:telefone",
      module: null,
      category: "inconsistencia_cadastral",
      title: "Sem telefone cadastrado",
      state: "aviso",
      blocking: false,
      reason: "Não há WhatsApp cadastrado para este aluno.",
      guidance: "Obter o número para conseguir contatá-lo.",
      action: null,
    });
  }
  return requirements;
}

export function evaluateStudent(facts: StudentFacts, context: EvaluationContext): Evaluation {
  const moduleResults: ModuleResult[] = [];
  const requirements: Requirement[] = [];
  for (const slug of MODULES) {
    const evaluated = evaluateModule(slug, facts, context.now);
    moduleResults.push(evaluated.result);
    requirements.push(...evaluated.requirements);
  }
  requirements.push(...cadastralRequirements(facts));

  const open = requirements.filter((r) => r.blocking && r.state !== "cumprido");
  let overall: OverallStatus;
  if (open.some((r) => r.state === "impedimento")) overall = "nao_apto";
  else if (open.some((r) => r.state === "pendente")) overall = "pendente";
  else if (open.some((r) => r.state === "em_conferencia")) overall = "em_conferencia";
  else if (open.some((r) => r.state === "em_andamento")) overall = "em_andamento";
  else overall = moduleResults.every((m) => m.status === "concluido") ? "apto" : "em_conferencia";

  const countable = open.filter((r) => r.state !== "em_andamento");
  const pendingCount = open.filter((r) => r.state === "pendente").length;
  return {
    studentId: facts.studentId,
    overall,
    modules: moduleResults,
    requirements,
    openCount: countable.length,
    pendingCount,
    categories: [...new Set(countable.map((r) => r.category))],
    nearlyDone: overall === "pendente" && countable.length === 1,
  };
}

export const OVERALL_LABELS: Record<OverallStatus, string> = {
  apto: "Apto",
  pendente: "Com pendências",
  em_conferencia: "Em conferência",
  nao_apto: "Não apto",
  em_andamento: "Em andamento",
};

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  concluido: "Concluído",
  em_andamento: "Em andamento",
  pendente: "Pendente",
  em_conferencia: "Em conferência",
  nao_concluido: "Não concluído",
};

export type { EvidenceOrigin };
