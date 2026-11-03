import type { Situation } from "@/modules/attendance/progress";

/** Os três módulos, em ordem de jornada. O slug é o mesmo de `volumes.slug`. */
export const MODULES = ["essencia", "caminho", "voz"] as const;
export type ModuleSlug = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleSlug, string> = { essencia: "Essência", caminho: "Caminho", voz: "Voz" };

/** Resultado acadêmico geral do aluno. Calculado, nunca digitado. */
export type OverallStatus = "apto" | "pendente" | "em_conferencia" | "nao_apto" | "em_andamento";

export type ModuleStatus = "concluido" | "em_andamento" | "pendente" | "em_conferencia" | "nao_concluido";

/** Estado de um requisito individual. `aviso` não bloqueia: só chama atenção. */
export type RequirementState = "cumprido" | "pendente" | "em_conferencia" | "impedimento" | "em_andamento" | "aviso";

export type PendencyCategory =
  | "avaliacao"
  | "frequencia"
  | "conclusao_essencia"
  | "conclusao_caminho"
  | "conclusao_voz"
  | "historico"
  | "inconsistencia_cadastral"
  | "outras";

export const PENDENCY_LABELS: Record<PendencyCategory, string> = {
  avaliacao: "Avaliação",
  frequencia: "Frequência",
  conclusao_essencia: "Conclusão de Essência",
  conclusao_caminho: "Conclusão de Caminho",
  conclusao_voz: "Conclusão de Voz",
  historico: "Histórico acadêmico",
  inconsistencia_cadastral: "Inconsistência cadastral",
  outras: "Outras pendências",
};

/** De onde veio a prova de que o módulo foi concluído. */
export type EvidenceOrigin = "matricula_concluida" | "historico_validado" | "plataforma" | "sem_evidencia";

export const ORIGIN_LABELS: Record<EvidenceOrigin, string> = {
  matricula_concluida: "Matrícula marcada como concluída",
  historico_validado: "Histórico validado pela coordenação",
  plataforma: "Frequência e avaliação registradas na plataforma",
  sem_evidencia: "Sem registro de conclusão",
};

// ---------------------------------------------------------------------------
// Fatos: o que o carregador lê do banco. O motor só enxerga isto.
// ---------------------------------------------------------------------------

export interface AttendanceFact {
  totalMinutes: number;
  attendedMinutes: number;
  missedMinutes: number;
  absences: number;
  situation: Situation;
  /** Todos os encontros da turma já terminaram. */
  allMeetingsPast: boolean;
  /** Data (AAAA-MM-DD) do último encontro da turma, se houver. */
  lastMeetingDate: string | null;
}

export interface AttemptFact {
  status: "in_progress" | "submitted" | "expired" | "canceled";
  score: number | null;
  submittedAt: string | null;
  deadlineAt: string | null;
}

export interface AssessmentFact {
  assessmentId: string;
  type: "final" | "recovery";
  status: "draft" | "open" | "closed";
  passingGrade: number;
  closesAt: string | null;
  /** Consta em `assessment_eligible_students` (conjunto fixo calculado na publicação). */
  eligible: boolean;
  attempts: AttemptFact[];
  /** Há tentativa excepcional autorizada pela coordenação. */
  extraAttemptGranted: boolean;
}

export interface EnrollmentFact {
  enrollmentId: string;
  volume: ModuleSlug;
  seasonId: string;
  seasonName: string;
  seasonStartsOn: string;
  className: string;
  /** `enrollments.status`: active, regularization, approved, failed, canceled, withdrawn. */
  status: string;
  finalGrade: number | null;
  /** Data da última alteração da matrícula (usada como data de conclusão quando a matrícula é "concluída"). */
  updatedAt: string;
  attendance: AttendanceFact | null;
  finalAssessment: AssessmentFact | null;
  recoveryAssessment: AssessmentFact | null;
}

export interface HistoryRecordFact {
  id: string;
  volume: ModuleSlug;
  seasonLabel: string | null;
  origin: string;
  evidence: string;
  validatedAt: string;
  validatedByName: string | null;
}

export interface DuplicateSuspect {
  profileId: string;
  name: string;
  /** Por que parece a mesma pessoa. Nunca é prova de identidade. */
  reason: string;
}

export interface StudentFacts {
  studentId: string;
  /** Id da inscrição (para abrir a ficha do aluno). */
  requestId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  enrollments: EnrollmentFact[];
  history: HistoryRecordFact[];
  /** Texto livre digitado na inscrição. Pista para a conferência, jamais prova. */
  prerequisiteNote: string | null;
  /** Pedidos de presença e autodeclarações ainda sem decisão. */
  pendingJustifications: number;
  suspectedDuplicates: DuplicateSuspect[];
}

export interface EvaluationContext {
  now: Date;
  minAttendanceRatio: number;
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export interface Requirement {
  /** Estável entre cálculos: `${módulo}:${tipo}`. É a chave do acompanhamento. */
  key: string;
  module: ModuleSlug | null;
  category: PendencyCategory;
  title: string;
  state: RequirementState;
  /** Só requisitos bloqueantes entram na decisão do resultado geral. */
  blocking: boolean;
  reason: string;
  guidance: string;
  action: { label: string; href: string } | null;
}

export interface ModuleResult {
  slug: ModuleSlug;
  label: string;
  status: ModuleStatus;
  origin: EvidenceOrigin;
  seasonName: string | null;
  className: string | null;
  /** AAAA-MM-DD, quando se conhece a data de conclusão. */
  completedOn: string | null;
  attendance: AttendanceFact | null;
  /** Melhor nota entre avaliação final e recuperação. */
  grade: number | null;
  passingGrade: number | null;
  note: string;
}

export interface Evaluation {
  studentId: string;
  overall: OverallStatus;
  modules: ModuleResult[];
  requirements: Requirement[];
  /** Requisitos bloqueantes não cumpridos (pendente, em conferência ou impedimento). */
  openCount: number;
  /** Quantas pendências regularizáveis (estado `pendente`). */
  pendingCount: number;
  /** Categorias com algum requisito aberto. */
  categories: PendencyCategory[];
  /** Pendente com um único requisito aberto: o mais próximo de virar apto. */
  nearlyDone: boolean;
}
