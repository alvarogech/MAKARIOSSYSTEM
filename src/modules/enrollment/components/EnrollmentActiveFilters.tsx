import Link from "next/link";
import { X } from "lucide-react";
import { grNetworkFilterLabel, periodLabel, scheduleLabel, volumeLabel } from "../labels";
import { ENROLLMENT_CHURCH_VINCULO_LABELS, ENROLLMENT_STATUS_LABELS, type EnrollmentFilters } from "../types";

type HrefBuilder = (overrides: Record<string, string | number | null>) => string;

function formatDateRangeLabel(from: string, to: string | null): string {
  const fromLabel = from.split("-").reverse().join("/");
  if (!to || to === from) return fromLabel;
  return `${fromLabel} a ${to.split("-").reverse().join("/")}`;
}

/**
 * Resumo dos filtros ativos acima da tabela: contagem + um badge removível
 * por filtro + "Limpar filtros" (só aparece quando há pelo menos um filtro
 * ativo). Cada badge remove só aquele filtro, preservando os demais — o
 * link de cada um já vem pronto de `buildHref`, a mesma função que monta
 * toda a navegação da página.
 */
export function EnrollmentActiveFilters({
  filters,
  buildHref,
  totalCount,
}: {
  filters: EnrollmentFilters;
  buildHref: HrefBuilder;
  totalCount: number;
}) {
  const badges: { key: string; label: string; href: string }[] = [];

  if (filters.q) {
    badges.push({ key: "q", label: `Busca: "${filters.q}"`, href: buildHref({ q: null, page: null }) });
  }
  if (filters.dateFrom) {
    badges.push({
      key: "date",
      label: `Data: ${formatDateRangeLabel(filters.dateFrom, filters.dateTo)}`,
      href: buildHref({ de: null, ate: null, page: null }),
    });
  } else if (filters.period !== "all") {
    badges.push({
      key: "period",
      label: `Período: ${periodLabel(filters.period)}`,
      href: buildHref({ period: null, page: null }),
    });
  }
  if (filters.volume !== "all") {
    badges.push({ key: "volume", label: `Curso: ${volumeLabel(filters.volume)}`, href: buildHref({ volume: null, page: null }) });
  }
  if (filters.schedule !== "all") {
    badges.push({
      key: "schedule",
      label: `Turma: ${scheduleLabel(filters.schedule)}`,
      href: buildHref({ schedule: null, page: null }),
    });
  }
  if (filters.status !== "all") {
    badges.push({
      key: "status",
      label: `Status: ${ENROLLMENT_STATUS_LABELS[filters.status]}`,
      href: buildHref({ status: null, page: null }),
    });
  }
  if (filters.churchVinculo !== "all") {
    badges.push({
      key: "vinculo",
      label: `Vínculo: ${ENROLLMENT_CHURCH_VINCULO_LABELS[filters.churchVinculo]}`,
      href: buildHref({ vinculo: null, page: null }),
    });
  }
  if (filters.grNetwork !== "all") {
    badges.push({
      key: "rede",
      label: `Rede: ${grNetworkFilterLabel(filters.grNetwork)}`,
      href: buildHref({ rede: null, page: null }),
    });
  }
  if (filters.notViewed) {
    badges.push({ key: "naoVistas", label: "Só não visualizadas", href: buildHref({ naoVistas: null, page: null }) });
  }

  const hasFilters = badges.length > 0;
  const countText = hasFilters
    ? `${totalCount} inscriç${totalCount === 1 ? "ão encontrada" : "ões encontradas"} para os filtros selecionados`
    : `${totalCount} inscriç${totalCount === 1 ? "ão encontrada" : "ões encontradas"}`;

  const clearAllHref = buildHref({
    q: null,
    period: null,
    de: null,
    ate: null,
    volume: null,
    schedule: null,
    status: null,
    vinculo: null,
    rede: null,
    naoVistas: null,
    page: null,
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-neutral-500">{countText}</p>
      {badges.map((badge) => (
        <Link
          key={badge.key}
          href={badge.href}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-danger/40 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
        >
          {badge.label}
          <X className="size-3" aria-hidden="true" />
          <span className="sr-only">(remover este filtro)</span>
        </Link>
      ))}
      {hasFilters ? (
        <Link
          href={clearAllHref}
          className="text-xs font-medium text-brand-blue hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
        >
          Limpar filtros
        </Link>
      ) : null}
    </div>
  );
}
