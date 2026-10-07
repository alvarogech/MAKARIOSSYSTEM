import type {
  EnrollmentGrNetworkSlug,
  EnrollmentScheduleSlug,
  EnrollmentVolumeSlug,
} from "@/config/enrollment";

export type EnrollmentRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Campos usados pela tabela/painel de detalhes — nunca inclui cpf_encrypted/cpf_hash. */
export interface EnrollmentRequestRow {
  id: string;
  protocol: string;
  fullName: string;
  cpfLast4: string;
  email: string;
  phone: string;
  primaryVolumeSlug: EnrollmentVolumeSlug;
  primaryScheduleSlug: EnrollmentScheduleSlug;
  wantsSecondVolume: boolean;
  secondaryVolumeSlug: EnrollmentVolumeSlug | null;
  secondaryScheduleSlug: EnrollmentScheduleSlug | null;
  prerequisiteDeclaration: string | null;
  notes: string | null;
  /** `null` = solicitação enviada antes de esta pergunta existir no formulário. */
  isOtherChurchMember: boolean | null;
  otherChurchName: string | null;
  isEmausMember: boolean | null;
  hasGr: boolean | null;
  grNetworkSlug: EnrollmentGrNetworkSlug | null;
  status: EnrollmentRequestStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  /** `null` = ninguém da coordenação abriu os detalhes ainda. Visualização é global, não por usuário. */
  viewedAt: string | null;
  viewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Preenchido quando a pessoa aceita o convite e cria a conta — `null` até lá. */
  studentId: string | null;
}

/** Linha enxuta (sem PII) usada só para agregação de estatísticas/gráfico. */
export interface EnrollmentStatsRow {
  status: EnrollmentRequestStatus;
  primaryVolumeSlug: EnrollmentVolumeSlug;
  primaryScheduleSlug: EnrollmentScheduleSlug;
  isOtherChurchMember: boolean | null;
  isEmausMember: boolean | null;
  hasGr: boolean | null;
  grNetworkSlug: EnrollmentGrNetworkSlug | null;
  viewedAt: string | null;
  createdAt: string;
  /** A pessoa já criou a conta (inscrição ligada a um aluno). */
  hasAccount: boolean;
}

export type ChurchVinculoValue = "member" | "other" | "nao_informado";

export interface EnrollmentStats {
  total: number;
  today: number;
  last7Days: number;
  last30Days: number;
  thisWeek: number;
  thisMonth: number;
  notViewedCount: number;
  /** Aprovadas cujo aluno ainda não criou a conta (sem matrícula). */
  approvedWithoutAccount: number;
  /** Vagas ocupadas por inscrições aprovadas, por "volume:horario". */
  approvedByTurma: Record<string, number>;
  byVolume: { slug: EnrollmentVolumeSlug; label: string; count: number }[];
  byVolumeSchedule: {
    volumeSlug: EnrollmentVolumeSlug;
    scheduleSlug: EnrollmentScheduleSlug;
    label: string;
    count: number;
  }[];
  byStatus: { status: EnrollmentRequestStatus; count: number }[];
  /** Categorias mutuamente exclusivas — a soma sempre fecha com `total`. */
  byChurchVinculo: { value: ChurchVinculoValue; label: string; count: number }[];
  /**
   * As 5 redes reais + "Sem GR" (membro da Emaús que confirmou não ter GR)
   * + "Não informado" (pergunta nunca respondida, ou não é da Emaús) — a
   * soma sempre fecha com `total`.
   */
  byGrNetwork: { slug: EnrollmentGrNetworkSlug; label: string; count: number }[];
  noGrCount: number;
  grNetworkNotInformedCount: number;
}

export type ChartGranularity = "day" | "week" | "month";

export interface ChartPoint {
  key: string;
  label: string;
  count: number;
  /** Início/fim (ISO) do intervalo representado por este ponto — usado para o filtro de data ao clicar. */
  rangeStart: string;
  rangeEnd: string;
}

export type EnrollmentSortField = "createdAt" | "fullName" | "primaryVolumeSlug" | "primaryScheduleSlug" | "status";
export type EnrollmentSortDir = "asc" | "desc";
export type EnrollmentGrNetworkFilterValue = EnrollmentGrNetworkSlug | "sem_gr" | "nao_informado";

export interface EnrollmentFilters {
  q: string;
  period: "all" | "today" | "7d" | "30d" | "week" | "month";
  /** Intervalo de data explícito (YYYY-MM-DD), usado ao clicar num ponto do gráfico. Tem prioridade sobre `period` quando presente. */
  dateFrom: string | null;
  dateTo: string | null;
  volume: EnrollmentVolumeSlug | "all";
  schedule: EnrollmentScheduleSlug | "all";
  status: EnrollmentRequestStatus | "all";
  churchVinculo: ChurchVinculoValue | "all";
  grNetwork: EnrollmentGrNetworkFilterValue | "all";
  notViewed: boolean;
  page: number;
  granularity: ChartGranularity;
  sort: EnrollmentSortField;
  dir: EnrollmentSortDir;
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentRequestStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

export const ENROLLMENT_CHURCH_VINCULO_LABELS: Record<ChurchVinculoValue, string> = {
  member: "Membro da Emaús",
  other: "Outro vínculo",
  nao_informado: "Não informado",
};

export const ENROLLMENT_PAGE_SIZE = 20;

export interface EnrollmentTurmaCapacity {
  id: string;
  volumeSlug: EnrollmentVolumeSlug;
  scheduleSlug: EnrollmentScheduleSlug;
  capacity: number;
}

/** Matrícula de um aluno, para o painel de detalhes da inscrição mover de turma direto dali. */
export interface StudentEnrollmentForTransfer {
  enrollmentId: string;
  status: string;
  classId: string;
  className: string;
  offeringLabel: string;
  classesInSameOffering: { id: string; name: string }[];
}

export interface DataQualityFlag {
  field: "email" | "phone";
  message: string;
  suggestion?: string;
}
