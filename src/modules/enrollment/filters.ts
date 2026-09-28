import { ENROLLMENT_GR_NETWORKS, ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import type {
  ChurchVinculoValue,
  EnrollmentFilters,
  EnrollmentGrNetworkFilterValue,
  EnrollmentRequestStatus,
  EnrollmentSortDir,
  EnrollmentSortField,
} from "./types";

const VALID_PERIODS: EnrollmentFilters["period"][] = ["all", "today", "7d", "30d", "week", "month"];
const VALID_STATUSES: EnrollmentRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];
const VALID_GRANULARITIES: EnrollmentFilters["granularity"][] = ["day", "week", "month"];
const VALID_VOLUMES = ENROLLMENT_VOLUMES.map((volume) => volume.slug);
const VALID_SCHEDULES = ENROLLMENT_SCHEDULES.map((schedule) => schedule.slug);
const VALID_CHURCH_VINCULOS: ChurchVinculoValue[] = ["member", "other", "nao_informado"];
const VALID_GR_NETWORK_FILTERS: EnrollmentGrNetworkFilterValue[] = [
  ...ENROLLMENT_GR_NETWORKS.map((network) => network.slug),
  "sem_gr",
  "nao_informado",
];
const VALID_SORT_FIELDS: EnrollmentSortField[] = [
  "createdAt",
  "fullName",
  "primaryVolumeSlug",
  "primaryScheduleSlug",
  "status",
];
const VALID_SORT_DIRS: EnrollmentSortDir[] = ["asc", "desc"];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(value: string | null): string | null {
  if (!value || !DATE_KEY_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

/**
 * Único ponto de validação dos filtros vindos da URL — usado pela página
 * (searchParams) e pela exportação CSV (URLSearchParams), para nunca
 * repassar um valor arbitrário direto a uma query do Supabase.
 */
export function parseEnrollmentFilters(get: (key: string) => string | null): EnrollmentFilters {
  const period = get("period");
  const volume = get("volume");
  const schedule = get("schedule");
  const status = get("status");
  const churchVinculo = get("vinculo");
  const grNetwork = get("rede");
  const granularity = get("granularity");
  const sort = get("sort");
  const dir = get("dir");
  const page = Number(get("page") ?? "1");

  return {
    q: get("q") ?? "",
    period: VALID_PERIODS.includes(period as EnrollmentFilters["period"])
      ? (period as EnrollmentFilters["period"])
      : "all",
    dateFrom: parseDateKey(get("de")),
    dateTo: parseDateKey(get("ate")),
    volume: VALID_VOLUMES.includes(volume as (typeof VALID_VOLUMES)[number])
      ? (volume as EnrollmentFilters["volume"])
      : "all",
    schedule: VALID_SCHEDULES.includes(schedule as (typeof VALID_SCHEDULES)[number])
      ? (schedule as EnrollmentFilters["schedule"])
      : "all",
    status: VALID_STATUSES.includes(status as EnrollmentRequestStatus)
      ? (status as EnrollmentRequestStatus)
      : "all",
    churchVinculo: VALID_CHURCH_VINCULOS.includes(churchVinculo as ChurchVinculoValue)
      ? (churchVinculo as ChurchVinculoValue)
      : "all",
    grNetwork: VALID_GR_NETWORK_FILTERS.includes(grNetwork as EnrollmentGrNetworkFilterValue)
      ? (grNetwork as EnrollmentGrNetworkFilterValue)
      : "all",
    notViewed: get("naoVistas") === "1",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    granularity: VALID_GRANULARITIES.includes(granularity as EnrollmentFilters["granularity"])
      ? (granularity as EnrollmentFilters["granularity"])
      : "day",
    sort: VALID_SORT_FIELDS.includes(sort as EnrollmentSortField) ? (sort as EnrollmentSortField) : "createdAt",
    dir: VALID_SORT_DIRS.includes(dir as EnrollmentSortDir) ? (dir as EnrollmentSortDir) : "desc",
  };
}
