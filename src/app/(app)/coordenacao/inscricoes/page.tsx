import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Alert } from "@/components/ui/Alert";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatSaoPauloDateTime } from "@/lib/saoPauloDate";
import { EnrollmentChart } from "@/modules/enrollment/components/EnrollmentChart";
import { EnrollmentDetailPanel } from "@/modules/enrollment/components/EnrollmentDetailPanel";
import { EnrollmentFiltersBar } from "@/modules/enrollment/components/EnrollmentFiltersBar";
import { EnrollmentRealtimeStatus } from "@/modules/enrollment/components/EnrollmentRealtimeStatus";
import { EnrollmentStatsCards } from "@/modules/enrollment/components/EnrollmentStatsCards";
import { EnrollmentTable } from "@/modules/enrollment/components/EnrollmentTable";
import { parseEnrollmentFilters } from "@/modules/enrollment/filters";
import {
  buildChartPoints,
  computeEnrollmentStats,
  getEnrollmentRequestById,
  getEnrollmentRequestsPage,
  getEnrollmentStatsRows,
} from "@/modules/enrollment/queries";
import { ENROLLMENT_PAGE_SIZE, type EnrollmentRequestRow } from "@/modules/enrollment/types";

export const metadata: Metadata = { title: "Inscrições" };

// Dashboard de acompanhamento em tempo real — nunca deve servir uma
// resposta cacheada/estática.
export const dynamic = "force-dynamic";

export default async function EnrollmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const rawParams = await searchParams;
  const getParam = (key: string): string | null => {
    const value = rawParams[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };
  const filters = parseEnrollmentFilters(getParam);
  const detailId = getParam("detail");

  const supabase = await createSupabaseServerClient();
  const now = new Date();

  function buildQueryParams(overrides: Record<string, string | number | null>): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.period !== "all") params.set("period", filters.period);
    if (filters.volume !== "all") params.set("volume", filters.volume);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.page > 1) params.set("page", String(filters.page));
    if (filters.granularity !== "day") params.set("granularity", filters.granularity);

    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, String(value));
    }

    return params;
  }

  function buildHref(overrides: Record<string, string | number | null>): string {
    const query = buildQueryParams(overrides).toString();
    return query ? `/coordenacao/inscricoes?${query}` : "/coordenacao/inscricoes";
  }

  // Passado como string simples para o EnrollmentTable (Client Component):
  // Server Components não podem passar funções para o cliente, então o
  // link de cada linha é montado lá juntando esta base com `detail=<id>`.
  const baseQueryForDetail = buildQueryParams({ detail: null }).toString();

  let loadError: string | null = null;
  let rows: EnrollmentRequestRow[] = [];
  let totalCount = 0;
  let stats = computeEnrollmentStats([], now);
  let chartPoints = buildChartPoints([], filters.granularity, now);
  let detailRow: EnrollmentRequestRow | null = null;

  try {
    const [statsRows, page] = await Promise.all([
      getEnrollmentStatsRows(supabase),
      getEnrollmentRequestsPage(supabase, filters, now),
    ]);

    rows = page.rows;
    totalCount = page.totalCount;
    stats = computeEnrollmentStats(statsRows, now);
    chartPoints = buildChartPoints(statsRows, filters.granularity, now);

    if (detailId) {
      detailRow =
        rows.find((row) => row.id === detailId) ??
        (await getEnrollmentRequestById(supabase, detailId));
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Não foi possível carregar as inscrições.";
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / ENROLLMENT_PAGE_SIZE));
  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", filters.q);
  if (filters.period !== "all") exportParams.set("period", filters.period);
  if (filters.volume !== "all") exportParams.set("volume", filters.volume);
  if (filters.status !== "all") exportParams.set("status", filters.status);
  const exportHref = `/coordenacao/inscricoes/export?${exportParams.toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Dashboard de Inscrições</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Acompanhamento em tempo real das inscrições recebidas pela página pública.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <EnrollmentRealtimeStatus />
          <p className="text-xs text-neutral-400">
            Última atualização: {formatSaoPauloDateTime(now.toISOString())}
          </p>
        </div>
      </div>

      {loadError ? (
        <Alert variant="danger">{loadError}</Alert>
      ) : (
        <>
          <EnrollmentStatsCards stats={stats} />

          <EnrollmentChart
            points={chartPoints}
            granularity={filters.granularity}
            buildHref={(granularity) => buildHref({ granularity })}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <EnrollmentFiltersBar initialQuery={filters.q} />
            </div>
            <a href={exportHref} className={buttonVariants({ variant: "secondary" })}>
              Exportar CSV
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
            <p>
              {totalCount} inscriç{totalCount === 1 ? "ão encontrada" : "ões encontradas"}
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-3">
                <Link
                  href={buildHref({ page: Math.max(1, filters.page - 1) })}
                  className={`text-sm font-medium ${
                    filters.page <= 1
                      ? "pointer-events-none text-neutral-300"
                      : "text-brand-blue hover:underline"
                  }`}
                >
                  Anterior
                </Link>
                <span className="text-xs text-neutral-400">
                  Página {filters.page} de {totalPages}
                </span>
                <Link
                  href={buildHref({ page: Math.min(totalPages, filters.page + 1) })}
                  className={`text-sm font-medium ${
                    filters.page >= totalPages
                      ? "pointer-events-none text-neutral-300"
                      : "text-brand-blue hover:underline"
                  }`}
                >
                  Próxima
                </Link>
              </div>
            ) : null}
          </div>

          <EnrollmentTable
            rows={rows}
            baseQueryForDetail={baseQueryForDetail}
            nowIso={now.toISOString()}
          />
        </>
      )}

      {detailRow ? (
        <EnrollmentDetailPanel row={detailRow} closeHref={buildHref({ detail: null })} />
      ) : null}
    </div>
  );
}
