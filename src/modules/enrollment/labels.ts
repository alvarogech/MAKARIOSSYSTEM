import { ENROLLMENT_GR_NETWORKS, ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";

/** Rótulos compartilhados entre tabela, painel de detalhes e exportação CSV. */
export function volumeLabel(slug: string | null): string {
  if (!slug) return "";
  return ENROLLMENT_VOLUMES.find((volume) => volume.slug === slug)?.label ?? slug;
}

export function scheduleLabel(slug: string | null): string {
  if (!slug) return "";
  return ENROLLMENT_SCHEDULES.find((schedule) => schedule.slug === slug)?.label ?? slug;
}

export function grNetworkLabel(slug: string | null): string {
  if (!slug) return "";
  return ENROLLMENT_GR_NETWORKS.find((network) => network.slug === slug)?.label ?? slug;
}

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

export function periodLabel(period: string): string {
  return PERIOD_LABELS[period] ?? period;
}

/** Rótulo de um filtro de rede de GR, incluindo os valores especiais "sem_gr"/"nao_informado". */
export function grNetworkFilterLabel(value: string): string {
  if (value === "sem_gr") return "Sem GR";
  if (value === "nao_informado") return "Não informado";
  return grNetworkLabel(value);
}
