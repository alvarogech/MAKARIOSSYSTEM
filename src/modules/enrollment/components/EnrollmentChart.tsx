import Link from "next/link";
import type { ChartGranularity, ChartPoint } from "../types";

const GRANULARITY_OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

/**
 * Gráfico de barras em SVG puro — sem biblioteca de gráficos (nenhuma
 * estava instalada; para um gráfico simples de contagem por período, SVG
 * direto é mais leve do que adicionar uma dependência nova). Alternar
 * dia/semana/mês é feito por link (muda `?granularity=`), então o próprio
 * Server Component recalcula os pontos — sem estado no cliente.
 */
export function EnrollmentChart({
  points,
  granularity,
  buildHref,
}: {
  points: ChartPoint[];
  granularity: ChartGranularity;
  buildHref: (granularity: ChartGranularity) => string;
}) {
  const max = Math.max(1, ...points.map((point) => point.count));
  const width = 760;
  const height = 220;
  const paddingBottom = 28;
  const barGap = 6;
  const barWidth = points.length > 0 ? (width - barGap * (points.length - 1)) / points.length : width;

  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Evolução das inscrições</h2>
        <div className="flex gap-1 rounded-full border border-neutral-200 p-0.5 text-xs" role="group" aria-label="Agrupar gráfico por">
          {GRANULARITY_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref(option.value)}
              aria-current={option.value === granularity ? "true" : undefined}
              className={`rounded-full px-3 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                option.value === granularity
                  ? "bg-brand-blue text-white"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {points.every((point) => point.count === 0) ? (
        <p className="mt-8 py-10 text-center text-sm text-neutral-400">
          Nenhuma inscrição neste período.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-4 h-52 w-full"
          role="img"
          aria-label="Gráfico de barras: quantidade de inscrições ao longo do tempo"
        >
          {points.map((point, index) => {
            const barHeight = (point.count / max) * (height - paddingBottom - 16);
            const x = index * (barWidth + barGap);
            const y = height - paddingBottom - barHeight;
            return (
              <g key={point.key}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, point.count > 0 ? 2 : 0)}
                  rx={3}
                  className="fill-brand-blue"
                />
                {point.count > 0 ? (
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    className="fill-neutral-500"
                    fontSize={10}
                  >
                    {point.count}
                  </text>
                ) : null}
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-neutral-400"
                  fontSize={10}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
