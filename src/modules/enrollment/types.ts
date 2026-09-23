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
  createdAt: string;
  updatedAt: string;
}

/** Linha enxuta (sem PII) usada só para agregação de estatísticas/gráfico. */
export interface EnrollmentStatsRow {
  status: EnrollmentRequestStatus;
  primaryVolumeSlug: EnrollmentVolumeSlug;
  primaryScheduleSlug: EnrollmentScheduleSlug;
  createdAt: string;
}

export interface EnrollmentStats {
  total: number;
  today: number;
  last7Days: number;
  last30Days: number;
  thisWeek: number;
  thisMonth: number;
  byVolume: { slug: EnrollmentVolumeSlug; label: string; count: number }[];
  byVolumeSchedule: {
    volumeSlug: EnrollmentVolumeSlug;
    scheduleSlug: EnrollmentScheduleSlug;
    label: string;
    count: number;
  }[];
  byStatus: { status: EnrollmentRequestStatus; count: number }[];
}

export type ChartGranularity = "day" | "week" | "month";

export interface ChartPoint {
  key: string;
  label: string;
  count: number;
}

export interface EnrollmentFilters {
  q: string;
  period: "all" | "today" | "7d" | "30d" | "week" | "month";
  volume: EnrollmentVolumeSlug | "all";
  status: EnrollmentRequestStatus | "all";
  page: number;
  granularity: ChartGranularity;
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentRequestStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

export const ENROLLMENT_PAGE_SIZE = 20;
