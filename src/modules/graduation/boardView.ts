import type { Evaluation, OverallStatus, PendencyCategory } from "./types";

/**
 * Visões do painel (puras e testáveis): linhas já calculadas entram, filtros,
 * ordenação e totais saem. Nada aqui lê banco nem decide elegibilidade.
 */

export const CONTACT_STATUSES = [
  "nao_contatado",
  "contato_realizado",
  "aguardando_aluno",
  "aguardando_coordenacao",
  "aguardando_atualizacao_academica",
  "regularizacao_concluida",
  "encerrado_sem_regularizacao",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_LABELS: Record<ContactStatus, string> = {
  nao_contatado: "Não contatado",
  contato_realizado: "Contato realizado",
  aguardando_aluno: "Aguardando aluno",
  aguardando_coordenacao: "Aguardando coordenação",
  aguardando_atualizacao_academica: "Aguardando atualização acadêmica",
  regularizacao_concluida: "Regularização concluída",
  encerrado_sem_regularizacao: "Encerrado sem regularização",
};

export interface FollowUpView {
  requirementKey: string;
  contactStatus: ContactStatus;
  responsibleId: string | null;
  responsibleName: string | null;
  nextStep: string | null;
  dueDate: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface ParticipantView {
  id: string;
  invitedAt: string | null;
  invitedStatus: string | null;
  response: "sem_resposta" | "confirmado" | "nao_comparece";
  respondedAt: string | null;
  responseSource: "aluno" | "coordenacao" | null;
  responseChannel: string | null;
  ceremonyAttendance: "nao_registrado" | "compareceu" | "nao_compareceu";
  certificateName: string | null;
  certificateNameCheckedAt: string | null;
  addedReason: string;
}

export interface BoardRow {
  studentId: string;
  requestId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  /** Turma e temporada de Voz (o módulo que define a edição). */
  className: string | null;
  seasonName: string | null;
  evaluation: Evaluation;
  vozAttendancePct: number | null;
  vozGrade: number | null;
  participant: ParticipantView;
  /** Acompanhamento do aluno como um todo (`requirement_key = 'geral'`). */
  followUp: FollowUpView | null;
  /** Acompanhamentos por pendência. */
  requirementFollowUps: FollowUpView[];
  lastContactAt: string | null;
}

// ----------------------------------------------------------------- filtros

export interface BoardFilters {
  q: string;
  status: OverallStatus | "";
  turma: string;
  temporada: string;
  pendencia: PendencyCategory | "";
  /** "1", "2", "3+" ou "". */
  quantidade: string;
  contato: ContactStatus | "";
  responsavel: string;
  /** Aba da central de regularização. */
  aba: string;
}

export const EMPTY_FILTERS: BoardFilters = {
  q: "",
  status: "",
  turma: "",
  temporada: "",
  pendencia: "",
  quantidade: "",
  contato: "",
  responsavel: "",
  aba: "todos",
};

const OVERALL = new Set<string>(["apto", "pendente", "em_conferencia", "nao_apto", "em_andamento"]);
const CATEGORIES = new Set<string>([
  "avaliacao",
  "frequencia",
  "conclusao_essencia",
  "conclusao_caminho",
  "conclusao_voz",
  "historico",
  "inconsistencia_cadastral",
  "outras",
]);

/** Lê os filtros da URL, descartando valores que não existem (nunca confia no que veio). */
export function parseFilters(params: Record<string, string | string[] | undefined>): BoardFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const status = one("status");
  const pendencia = one("pendencia");
  const contato = one("contato");
  const quantidade = one("quantidade");
  return {
    q: one("q").slice(0, 80),
    status: OVERALL.has(status) ? (status as OverallStatus) : "",
    turma: one("turma").slice(0, 120),
    temporada: one("temporada").slice(0, 40),
    pendencia: CATEGORIES.has(pendencia) ? (pendencia as PendencyCategory) : "",
    quantidade: ["1", "2", "3+"].includes(quantidade) ? quantidade : "",
    contato: (CONTACT_STATUSES as readonly string[]).includes(contato) ? (contato as ContactStatus) : "",
    responsavel: one("responsavel").slice(0, 40),
    aba: one("aba") || "todos",
  };
}

const strip = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const digits = (text: string) => text.replace(/\D/g, "");

export function contactStatusOf(row: BoardRow): ContactStatus {
  return row.followUp?.contactStatus ?? "nao_contatado";
}

export function applyFilters(rows: BoardRow[], filters: BoardFilters): BoardRow[] {
  const q = strip(filters.q);
  const qDigits = digits(filters.q);
  return rows.filter((row) => {
    if (q) {
      const hit =
        strip(row.name).includes(q) ||
        strip(row.email ?? "").includes(q) ||
        (qDigits.length >= 4 && digits(row.phone ?? "").includes(qDigits));
      if (!hit) return false;
    }
    if (filters.status && row.evaluation.overall !== filters.status) return false;
    if (filters.turma && row.className !== filters.turma) return false;
    if (filters.temporada && row.seasonName !== filters.temporada) return false;
    if (filters.pendencia && !row.evaluation.categories.includes(filters.pendencia)) return false;
    if (filters.quantidade) {
      const n = row.evaluation.openCount;
      if (filters.quantidade === "3+" ? n < 3 : n !== Number(filters.quantidade)) return false;
    }
    if (filters.contato && contactStatusOf(row) !== filters.contato) return false;
    if (filters.responsavel) {
      const mine = row.followUp?.responsibleId ?? "";
      if (filters.responsavel === "sem" ? mine !== "" : mine !== filters.responsavel) return false;
    }
    return true;
  });
}

// --------------------------------------------------- central de regularização

export const REGULARIZATION_TABS = [
  { code: "todos", label: "Todos os pendentes" },
  { code: "avaliacao", label: "Avaliação pendente" },
  { code: "frequencia", label: "Frequência pendente" },
  { code: "historico", label: "Histórico em conferência" },
  { code: "aguardando_aluno", label: "Aguardando resposta do aluno" },
  { code: "aguardando_coordenacao", label: "Aguardando ação da coordenação" },
  { code: "regularizados", label: "Regularizados" },
] as const;

const WORKABLE: ReadonlySet<OverallStatus> = new Set(["pendente", "em_conferencia", "nao_apto"]);
const HISTORY_CATEGORIES: ReadonlySet<PendencyCategory> = new Set(["historico", "conclusao_essencia", "conclusao_caminho", "conclusao_voz", "inconsistencia_cadastral"]);

/** Foi acompanhado e hoje está apto: regularizado de verdade, comprovado pelos dados, não por declaração. */
export function isRegularized(row: BoardRow): boolean {
  const followed = row.followUp !== null || row.requirementFollowUps.length > 0 || row.lastContactAt !== null;
  return followed && row.evaluation.overall === "apto";
}

/** Marcado como regularizado pela coordenação, mas os dados ainda mostram pendência. */
export function claimsRegularizedButNot(row: BoardRow): boolean {
  return row.followUp?.contactStatus === "regularizacao_concluida" && row.evaluation.overall !== "apto";
}

export function inTab(row: BoardRow, tab: string): boolean {
  const { overall, categories } = row.evaluation;
  const status = contactStatusOf(row);
  switch (tab) {
    case "regularizados":
      return isRegularized(row);
    case "avaliacao":
      return WORKABLE.has(overall) && categories.includes("avaliacao");
    case "frequencia":
      return WORKABLE.has(overall) && categories.includes("frequencia");
    case "historico":
      return WORKABLE.has(overall) && categories.some((c) => HISTORY_CATEGORIES.has(c));
    case "aguardando_aluno":
      return WORKABLE.has(overall) && status === "aguardando_aluno";
    case "aguardando_coordenacao":
      return WORKABLE.has(overall) && (status === "aguardando_coordenacao" || status === "aguardando_atualizacao_academica");
    default:
      return WORKABLE.has(overall);
  }
}

/** Primeira data de prazo entre os acompanhamentos do aluno (a mais próxima). */
export function nearestDue(row: BoardRow): string | null {
  const dates = [row.followUp?.dueDate, ...row.requirementFollowUps.map((f) => f.dueDate)].filter((d): d is string => !!d);
  return dates.sort()[0] ?? null;
}

/**
 * Ordem de trabalho: quem está a uma pendência de concluir primeiro (ampliar
 * formandos rápido), depois prazo próximo, depois quem ainda não foi contatado,
 * depois os demais, do menos para o mais pendente.
 */
export function sortForRegularization(rows: BoardRow[], todayKey: string): BoardRow[] {
  const rank = (row: BoardRow) => {
    if (row.evaluation.nearlyDone) return 0;
    const due = nearestDue(row);
    if (due && due <= addDays(todayKey, 7)) return 1;
    if (contactStatusOf(row) === "nao_contatado") return 2;
    return 3;
  };
  return [...rows].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const da = nearestDue(a);
    const db = nearestDue(b);
    if (da && db && da !== db) return da.localeCompare(db);
    if (da && !db) return -1;
    if (!da && db) return 1;
    if (a.evaluation.openCount !== b.evaluation.openCount) return a.evaluation.openCount - b.evaluation.openCount;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(row: BoardRow, todayKey: string): boolean {
  const due = nearestDue(row);
  return !!due && due < todayKey && contactStatusOf(row) !== "regularizacao_concluida" && contactStatusOf(row) !== "encerrado_sem_regularizacao";
}

// ----------------------------------------------------------------- totais

export interface BoardSummary {
  candidates: number;
  apto: number;
  pendente: number;
  em_conferencia: number;
  nao_apto: number;
  em_andamento: number;
  /** Pendentes a um único requisito de virar aptos. */
  nearlyDone: number;
  /** Alunos por categoria de pendência (um aluno pode contar em várias). */
  byCategory: Record<PendencyCategory, number>;
  toContact: number;
  regularized: number;
}

export function summarize(rows: BoardRow[]): BoardSummary {
  const byCategory: Record<PendencyCategory, number> = {
    avaliacao: 0,
    frequencia: 0,
    conclusao_essencia: 0,
    conclusao_caminho: 0,
    conclusao_voz: 0,
    historico: 0,
    inconsistencia_cadastral: 0,
    outras: 0,
  };
  const summary: BoardSummary = {
    candidates: rows.length,
    apto: 0,
    pendente: 0,
    em_conferencia: 0,
    nao_apto: 0,
    em_andamento: 0,
    nearlyDone: 0,
    byCategory,
    toContact: 0,
    regularized: 0,
  };
  for (const row of rows) {
    summary[row.evaluation.overall]++;
    if (row.evaluation.nearlyDone) summary.nearlyDone++;
    for (const category of row.evaluation.categories) byCategory[category]++;
    if (WORKABLE.has(row.evaluation.overall) && contactStatusOf(row) === "nao_contatado") summary.toContact++;
    if (isRegularized(row)) summary.regularized++;
  }
  return summary;
}
