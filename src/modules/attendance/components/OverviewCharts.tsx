import type { ClassStat } from "../overview";

const COLORS = ["#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#475569"];
const REFERENCE = 75;

/** Barras horizontais: frequência média de cada turma, com a linha dos 75%. */
export function ClassBars({ classes }: { classes: ClassStat[] }) {
  const rowH = 34;
  const width = 560;
  const left = 150;
  const barMax = width - left - 40;
  return (
    <svg viewBox={`0 0 ${width} ${classes.length * rowH + 30}`} className="w-full" role="img" aria-label="Frequência média por turma">
      {classes.map((klass, i) => {
        const y = i * rowH + 8;
        const value = klass.avgPct ?? 0;
        const color = klass.avgPct === null ? "#cbd5e1" : value >= REFERENCE ? "#15803d" : value >= 60 ? "#d97706" : "#b91c1c";
        return (
          <g key={klass.id}>
            <text x={0} y={y + 16} fontSize={11} fill="#334155">
              {klass.label}
            </text>
            <rect x={left} y={y} width={barMax} height={20} rx={4} fill="#f1f5f9" />
            <rect x={left} y={y} width={(barMax * value) / 100} height={20} rx={4} fill={color} />
            <text x={left + (barMax * value) / 100 + 6} y={y + 15} fontSize={11} fill="#0f172a">
              {klass.avgPct === null ? "—" : `${klass.avgPct}%`}
            </text>
          </g>
        );
      })}
      <line x1={left + (barMax * REFERENCE) / 100} x2={left + (barMax * REFERENCE) / 100} y1={0} y2={classes.length * rowH + 4} stroke="#0f172a" strokeDasharray="4 3" />
      <text x={left + (barMax * REFERENCE) / 100} y={classes.length * rowH + 20} fontSize={10} textAnchor="middle" fill="#0f172a">
        75%
      </text>
    </svg>
  );
}

/** Linhas: % de presença de cada turma ao longo dos encontros já realizados. */
export function EvolutionLines({ classes }: { classes: ClassStat[] }) {
  const width = 560;
  const height = 220;
  const pad = { l: 34, r: 12, t: 12, b: 28 };
  const maxSeq = Math.max(1, ...classes.flatMap((c) => c.meetings.map((m) => m.sequence)));
  const x = (seq: number) => pad.l + ((width - pad.l - pad.r) * (maxSeq === 1 ? 0.5 : (seq - 1) / (maxSeq - 1)));
  const y = (value: number) => pad.t + (height - pad.t - pad.b) * (1 - value / 100);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Presença por encontro, por turma">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke={tick === REFERENCE ? "#0f172a" : "#e2e8f0"} strokeDasharray={tick === REFERENCE ? "4 3" : undefined} />
            <text x={pad.l - 6} y={y(tick) + 3} fontSize={10} textAnchor="end" fill="#64748b">
              {tick}
            </text>
          </g>
        ))}
        {Array.from({ length: maxSeq }, (_, i) => i + 1).map((seq) => (
          <text key={seq} x={x(seq)} y={height - 8} fontSize={10} textAnchor="middle" fill="#64748b">
            E{seq}
          </text>
        ))}
        {classes.map((klass, index) => {
          const points = klass.meetings.filter((m) => m.past && m.pct !== null);
          const color = COLORS[index % COLORS.length]!;
          return (
            <g key={klass.id}>
              <polyline fill="none" stroke={color} strokeWidth={2} points={points.map((m) => `${x(m.sequence)},${y(m.pct!)}`).join(" ")} />
              {points.map((m) => (
                <circle key={m.id} cx={x(m.sequence)} cy={y(m.pct!)} r={3.5} fill={color}>
                  <title>{`${klass.label}, encontro ${m.sequence}: ${m.pct}%`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        {classes.map((klass, index) => (
          <li key={klass.id} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} aria-hidden="true" />
            {klass.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pequenas barras: % presente em cada aula do último encontro realizado de cada turma. */
export function LessonBars({ classes }: { classes: ClassStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((klass) => {
        const last = [...klass.meetings].filter((m) => m.past).sort((a, b) => b.sequence - a.sequence)[0];
        return (
          <div key={klass.id} className="rounded-[var(--radius-sm)] border border-neutral-100 p-3">
            <p className="text-xs font-medium text-neutral-700">
              {klass.label}
              {last ? ` · encontro ${last.sequence}` : ""}
            </p>
            {last ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {last.lessonPct.map((value, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-14 shrink-0 text-neutral-500">Aula {i + 1}</span>
                    <span className="h-3 flex-1 rounded bg-neutral-100">
                      <span className="block h-3 rounded bg-brand-blue" style={{ width: `${value}%` }} />
                    </span>
                    <span className="w-9 shrink-0 text-right text-neutral-700">{value}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-neutral-400">Nenhum encontro realizado.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Distribuição dos alunos por faixa de frequência. */
export function Histogram({ bins }: { bins: { label: string; count: number }[] }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const colors = ["#15803d", "#65a30d", "#d97706", "#b91c1c"];
  return (
    <ul className="flex flex-col gap-2">
      {bins.map((bin, i) => (
        <li key={bin.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-neutral-600">{bin.label}</span>
          <span className="h-4 flex-1 rounded bg-neutral-100">
            <span className="block h-4 rounded" style={{ width: `${(bin.count / max) * 100}%`, background: colors[i] }} />
          </span>
          <span className="w-8 shrink-0 text-right font-medium text-neutral-800">{bin.count}</span>
        </li>
      ))}
    </ul>
  );
}

function cellStyle(pct: number | null, past: boolean): { background: string; color: string } {
  if (!past) return { background: "#f8fafc", color: "#94a3b8" };
  if (pct === null) return { background: "#f1f5f9", color: "#64748b" };
  if (pct >= 75) return { background: "#dcfce7", color: "#166534" };
  if (pct >= 50) return { background: "#fef3c7", color: "#92400e" };
  return { background: "#fee2e2", color: "#991b1b" };
}

/** Mapa de calor: turma × encontro. */
export function Heatmap({ classes, maxSequence }: { classes: ClassStat[]; maxSequence: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="text-left font-medium text-neutral-500">Turma</th>
            {Array.from({ length: maxSequence }, (_, i) => (
              <th key={i} className="font-medium text-neutral-500">
                E{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map((klass) => (
            <tr key={klass.id}>
              <td className="pr-2 whitespace-nowrap text-neutral-700">{klass.label}</td>
              {Array.from({ length: maxSequence }, (_, i) => {
                const m = klass.meetings.find((x) => x.sequence === i + 1);
                if (!m) return <td key={i} />;
                const style = cellStyle(m.pct, m.past);
                return (
                  <td key={i} className="rounded px-2 py-1.5 text-center font-medium" style={style} title={`${klass.label}, encontro ${i + 1}`}>
                    {m.past ? (m.pct === null ? "—" : `${Math.round(m.pct)}%`) : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
