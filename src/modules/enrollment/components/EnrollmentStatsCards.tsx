import Link from "next/link";
import { Check } from "lucide-react";
import type { EnrollmentScheduleSlug, EnrollmentVolumeSlug } from "@/config/enrollment";
import { EnrollmentCapacityEditor } from "./EnrollmentCapacityEditor";
import { EnrollmentStatusBadge } from "./EnrollmentStatusBadge";
import type { EnrollmentFilters, EnrollmentStats, EnrollmentTurmaCapacity } from "../types";

type HrefBuilder = (overrides: Record<string, string | number | null>) => string;

function percentOf(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/** Card de indicador simples (contagem), sempre um link — nunca uma div com onClick. */
function MetricCard({
  label,
  value,
  href,
  selected,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  selected?: boolean;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      title={hint}
      aria-pressed={selected}
      className={`rounded-[var(--radius-md)] border p-4 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
        selected
          ? "border-brand-blue bg-brand-blue-light"
          : "border-neutral-200 bg-white hover:border-brand-blue/40"
      }`}
    >
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {selected ? <Check className="size-3 text-brand-blue" aria-hidden="true" /> : null}
        {label}
      </p>
      {hint ? <p className="mt-1 text-[11px] font-normal normal-case text-neutral-400">{hint}</p> : null}
    </Link>
  );
}

/** Linha de segmentação clicável — nome, contagem, percentual e barra proporcional. */
function SegmentRow({
  label,
  count,
  total,
  href,
  selected,
  extra,
}: {
  label: React.ReactNode;
  count: number;
  total: number;
  href: string;
  selected: boolean;
  extra?: React.ReactNode;
}) {
  const percent = percentOf(count, total);
  return (
    <li>
      <Link
        href={href}
        aria-pressed={selected}
        className={`flex flex-col gap-1 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
          selected ? "bg-brand-blue-light" : "hover:bg-neutral-50"
        }`}
      >
        <span className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 text-neutral-700">
            {selected ? <Check className="size-3.5 shrink-0 text-brand-blue" aria-hidden="true" /> : null}
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0 font-semibold text-neutral-900">
            {count} <span className="font-normal text-neutral-400">· {percent}%</span>
          </span>
        </span>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand-blue" style={{ width: `${percent}%` }} />
        </span>
      </Link>
      {extra ? <div className="mt-1 pl-2">{extra}</div> : null}
    </li>
  );
}

function occupancyLabel(count: number, capacity: number): { text: string; className: string } {
  const percent = Math.round((count / capacity) * 100);
  if (percent >= 100) return { text: "Turma lotada", className: "text-danger" };
  if (percent >= 80) return { text: `Atenção · ${percent}% ocupada`, className: "text-warning" };
  return { text: `${percent}% ocupada`, className: "text-neutral-400" };
}

export function EnrollmentStatsCards({
  stats,
  filters,
  buildHref,
  capacities,
  seasonId,
}: {
  stats: EnrollmentStats;
  filters: EnrollmentFilters;
  buildHref: HrefBuilder;
  capacities: EnrollmentTurmaCapacity[];
  seasonId: string | null;
}) {
  const capacityByKey = new Map(
    capacities.map((c) => [`${c.volumeSlug}:${c.scheduleSlug}`, c.capacity]),
  );

  const noPeriodFilter = filters.period === "all" && !filters.dateFrom && !filters.dateTo;

  const primaryCards: { label: string; value: number; href: string; selected: boolean; hint?: string }[] = [
    {
      label: "Total de inscrições",
      value: stats.total,
      href: buildHref({ period: "all", de: null, ate: null, page: null }),
      selected: noPeriodFilter,
    },
    {
      label: "Hoje",
      value: stats.today,
      href: buildHref({ period: "today", de: null, ate: null, page: null }),
      selected: filters.period === "today" && !filters.dateFrom,
      hint: "Desde 00h no horário de Brasília.",
    },
    {
      label: "Não visualizadas",
      value: stats.notViewedCount,
      href: buildHref({ naoVistas: filters.notViewed ? null : "1", page: null }),
      selected: filters.notViewed,
      hint: "Ainda não abertas por ninguém da coordenação.",
    },
    {
      label: "Pendentes",
      value: stats.byStatus.find((s) => s.status === "pending")?.count ?? 0,
      href: buildHref({ status: filters.status === "pending" ? null : "pending", page: null }),
      selected: filters.status === "pending",
    },
    {
      label: "Aprovadas",
      value: stats.byStatus.find((s) => s.status === "approved")?.count ?? 0,
      href: buildHref({ status: filters.status === "approved" ? null : "approved", page: null }),
      selected: filters.status === "approved",
    },
  ];

  const secondaryCards: { label: string; value: number; href: string; selected: boolean; hint: string }[] = [
    {
      label: "Esta semana",
      value: stats.thisWeek,
      href: buildHref({ period: "week", de: null, ate: null, page: null }),
      selected: filters.period === "week" && !filters.dateFrom,
      hint: "Semana atual, desde segunda-feira.",
    },
    {
      label: "Este mês",
      value: stats.thisMonth,
      href: buildHref({ period: "month", de: null, ate: null, page: null }),
      selected: filters.period === "month" && !filters.dateFrom,
      hint: "Desde o primeiro dia do mês atual.",
    },
    {
      label: "Últimos 7 dias",
      value: stats.last7Days,
      href: buildHref({ period: "7d", de: null, ate: null, page: null }),
      selected: filters.period === "7d" && !filters.dateFrom,
      hint: "Janela móvel de 7 dias, incluindo hoje.",
    },
    {
      label: "Últimos 30 dias",
      value: stats.last30Days,
      href: buildHref({ period: "30d", de: null, ate: null, page: null }),
      selected: filters.period === "30d" && !filters.dateFrom,
      hint: "Janela móvel de 30 dias, incluindo hoje.",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {primaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {secondaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por curso</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {stats.byVolume.map((volume) => (
              <SegmentRow
                key={volume.slug}
                label={volume.label}
                count={volume.count}
                total={stats.total}
                href={buildHref({ volume: filters.volume === volume.slug ? null : volume.slug, page: null })}
                selected={filters.volume === volume.slug}
              />
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por turma</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {stats.byVolumeSchedule.map((entry) => {
              const key = `${entry.volumeSlug}:${entry.scheduleSlug}`;
              const capacity = capacityByKey.get(key) ?? null;
              const selected = filters.volume === entry.volumeSlug && filters.schedule === entry.scheduleSlug;
              return (
                <SegmentRow
                  key={key}
                  label={
                    <span className="flex flex-col">
                      <span>{entry.label}</span>
                      {capacity ? (
                        <span className={`text-[11px] font-normal ${occupancyLabel(entry.count, capacity).className}`}>
                          {entry.count} de {capacity} vagas preenchidas · {occupancyLabel(entry.count, capacity).text}
                        </span>
                      ) : null}
                    </span>
                  }
                  count={entry.count}
                  total={stats.total}
                  href={buildHref({
                    volume: selected ? null : entry.volumeSlug,
                    schedule: selected ? null : entry.scheduleSlug,
                    page: null,
                  })}
                  selected={selected}
                  extra={
                    seasonId ? (
                      <EnrollmentCapacityEditor
                        seasonId={seasonId}
                        volumeSlug={entry.volumeSlug as EnrollmentVolumeSlug}
                        scheduleSlug={entry.scheduleSlug as EnrollmentScheduleSlug}
                        currentCapacity={capacity}
                      />
                    ) : null
                  }
                />
              );
            })}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por status</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {stats.byStatus.map((entry) => (
              <SegmentRow
                key={entry.status}
                label={<EnrollmentStatusBadge status={entry.status} />}
                count={entry.count}
                total={stats.total}
                href={buildHref({ status: filters.status === entry.status ? null : entry.status, page: null })}
                selected={filters.status === entry.status}
              />
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Vínculo com a igreja</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {stats.byChurchVinculo.map((entry) => (
              <SegmentRow
                key={entry.value}
                label={entry.label}
                count={entry.count}
                total={stats.total}
                href={buildHref({ vinculo: filters.churchVinculo === entry.value ? null : entry.value, page: null })}
                selected={filters.churchVinculo === entry.value}
              />
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por rede de GR</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {stats.byGrNetwork.map((network) => (
              <SegmentRow
                key={network.slug}
                label={network.label}
                count={network.count}
                total={stats.total}
                href={buildHref({ rede: filters.grNetwork === network.slug ? null : network.slug, page: null })}
                selected={filters.grNetwork === network.slug}
              />
            ))}
            <SegmentRow
              label="Sem GR"
              count={stats.noGrCount}
              total={stats.total}
              href={buildHref({ rede: filters.grNetwork === "sem_gr" ? null : "sem_gr", page: null })}
              selected={filters.grNetwork === "sem_gr"}
            />
            <SegmentRow
              label="Não informado"
              count={stats.grNetworkNotInformedCount}
              total={stats.total}
              href={buildHref({ rede: filters.grNetwork === "nao_informado" ? null : "nao_informado", page: null })}
              selected={filters.grNetwork === "nao_informado"}
            />
          </ul>
        </div>
      </div>
    </div>
  );
}
