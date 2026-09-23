import { ENROLLMENT_VOLUMES } from "@/config/enrollment";
import type { EnrollmentFilters, EnrollmentRequestStatus } from "./types";

const VALID_PERIODS: EnrollmentFilters["period"][] = ["all", "today", "7d", "30d", "week", "month"];
const VALID_STATUSES: EnrollmentRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];
const VALID_GRANULARITIES: EnrollmentFilters["granularity"][] = ["day", "week", "month"];
const VALID_VOLUMES = ENROLLMENT_VOLUMES.map((volume) => volume.slug);

/**
 * Único ponto de validação dos filtros vindos da URL — usado pela página
 * (searchParams) e pela exportação CSV (URLSearchParams), para nunca
 * repassar um valor arbitrário direto a uma query do Supabase.
 */
export function parseEnrollmentFilters(get: (key: string) => string | null): EnrollmentFilters {
  const period = get("period");
  const volume = get("volume");
  const status = get("status");
  const granularity = get("granularity");
  const page = Number(get("page") ?? "1");

  return {
    q: get("q") ?? "",
    period: VALID_PERIODS.includes(period as EnrollmentFilters["period"])
      ? (period as EnrollmentFilters["period"])
      : "all",
    volume: VALID_VOLUMES.includes(volume as (typeof VALID_VOLUMES)[number])
      ? (volume as EnrollmentFilters["volume"])
      : "all",
    status: VALID_STATUSES.includes(status as EnrollmentRequestStatus)
      ? (status as EnrollmentRequestStatus)
      : "all",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    granularity: VALID_GRANULARITIES.includes(granularity as EnrollmentFilters["granularity"])
      ? (granularity as EnrollmentFilters["granularity"])
      : "day",
  };
}
