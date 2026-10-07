import Link from "next/link";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { buildWhatsAppLink } from "@/services/whatsapp";
import { isValidBrazilianPhone } from "@/services/phone";
import { formatHours } from "../progress";
import { SITUATION } from "../situation";
import { loadOverview, type OverviewFilters } from "../overviewLoader";
import { ClassBars, EvolutionLines, Heatmap, Histogram, LessonBars } from "./OverviewCharts";

const selectClass = "rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1 text-sm";

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
      {note ? <p className="text-xs text-neutral-500">{note}</p> : null}
    </Card>
  );
}

const fmt = (n: number | null) => (n === null ? "—" : `${n}%`);

export async function OverviewTab({
  seasonId,
  filters,
  baseQuery,
}: {
  seasonId: string;
  filters: OverviewFilters;
  /** Parâmetros que a aba preserva ao filtrar (temporada, dia). */
  baseQuery: { temporada: string; dia: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { overview, classOptions, maxSequence } = await loadOverview(supabase, seasonId, filters);
  const { bands, sources } = overview;

  const volumes = [...new Set(classOptions.map((c) => c.volume))];
  const atRisk = overview.classes
    .flatMap((klass) => klass.people.filter((p) => p.progress.situation === "no_limite" || p.progress.situation === "reprovado").map((p) => ({ klass, p })))
    .sort((a, b) => Number(b.p.progress.situation === "reprovado") - Number(a.p.progress.situation === "reprovado") || a.p.name.localeCompare(b.p.name));

  const csvParams = new URLSearchParams({ temporada: baseQuery.temporada });
  if (filters.volume) csvParams.set("volume", filters.volume);
  if (filters.classId) csvParams.set("turma", filters.classId);

  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <input type="hidden" name="aba" value="visao" />
        <input type="hidden" name="temporada" value={baseQuery.temporada} />
        <input type="hidden" name="dia" value={baseQuery.dia} />
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Volume
          <select name="volume" defaultValue={filters.volume ?? ""} className={selectClass}>
            <option value="">Todos</option>
            {volumes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Turma
          <select name="turma" defaultValue={filters.classId ?? ""} className={selectClass}>
            <option value="">Todas</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          De
          <input type="date" name="de" defaultValue={filters.from ?? ""} className={selectClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Até
          <input type="date" name="ate" defaultValue={filters.to ?? ""} className={selectClass} />
        </label>
        <button type="submit" className="pb-1.5 text-brand-blue hover:underline">
          Filtrar
        </button>
      </form>

      {overview.anomalies.length > 0 ? (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-danger">Possíveis falhas técnicas ({overview.anomalies.length})</h2>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-neutral-800">
                {overview.anomalies.map((a, i) => (
                  <li key={i}>
                    <span className={a.severity === "alta" ? "font-semibold text-danger" : "font-medium text-amber-700"}>
                      {a.severity === "alta" ? "● " : "○ "}
                    </span>
                    {a.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-success/30 bg-success/5 p-4 text-sm text-success">Nenhuma anomalia detectada nos encontros realizados.</Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Frequência média" value={fmt(overview.avgPct)} note="dos encontros já realizados" />
        <Kpi
          label="Em dia · atenção · crítico"
          value={`${bands.emDia} · ${bands.atencao} · ${bands.critico}`}
          note={bands.total > 0 ? `${Math.round((bands.emDia / bands.total) * 100)}% · ${Math.round((bands.atencao / bands.total) * 100)}% · ${Math.round((bands.critico / bands.total) * 100)}% dos ${bands.total} alunos` : undefined}
        />
        <Kpi
          label="Último encontro"
          value={overview.lastMeeting ? fmt(overview.lastMeeting.pct) : "—"}
          note={
            overview.lastMeeting
              ? `${overview.lastMeeting.label}${overview.lastMeeting.versusAvg !== null ? ` · ${overview.lastMeeting.versusAvg >= 0 ? "+" : ""}${overview.lastMeeting.versusAvg} p.p. vs média` : ""}`
              : "nenhum realizado"
          }
        />
        <Kpi
          label="Registros por origem"
          value={String(sources.qr + sources.manual + sources.reposicao + sources.autodeclaracao)}
          note={`QR ${sources.qr} · manual ${sources.manual} · reposição ${sources.reposicao} · autodeclaração ${sources.autodeclaracao}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Frequência por turma</h2>
          <ClassBars classes={overview.classes} />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Evolução por encontro</h2>
          <EvolutionLines classes={overview.classes} />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Alunos por faixa de frequência</h2>
          <Histogram bins={overview.histogram} />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Mapa turma × encontro</h2>
          <Heatmap classes={overview.classes} maxSequence={maxSequence} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Presença por aula dentro do último encontro</h2>
        <p className="mb-3 text-xs text-neutral-500">Mostra evasão depois do intervalo e falha no registro da volta.</p>
        <LessonBars classes={overview.classes} />
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Alunos em risco ({atRisk.length})</h2>
          <Link href={`/coordenacao/presenca/riscos?${csvParams.toString()}`} className="text-sm font-medium text-brand-blue hover:underline">
            Exportar CSV
          </Link>
        </div>
        <ul className="mt-2 flex flex-col divide-y divide-neutral-100 text-sm">
          {atRisk.slice(0, 80).map(({ klass, p }) => (
            <li key={`${klass.id}-${p.key}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{p.name}</p>
                <p className="text-xs text-neutral-500">
                  {klass.label} · {formatHours(p.progress.attendedMinutes)} de {formatHours(p.progress.totalMinutes)}
                  {p.pctSoFar !== null ? ` · ${p.pctSoFar}% dos encontros realizados` : ""} · {p.progress.absences} encontro(s) sem presença
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUATION[p.progress.situation].className}`}>
                  {SITUATION[p.progress.situation].label}
                </span>
                {p.phone && isValidBrazilianPhone(p.phone) ? (
                  <a
                    href={buildWhatsAppLink(p.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </li>
          ))}
          {atRisk.length === 0 ? <li className="py-2 text-neutral-400">Ninguém em risco por enquanto.</li> : null}
        </ul>
        {atRisk.length > 80 ? <p className="mt-2 text-xs text-neutral-500">Mostrando 80 de {atRisk.length}; exporte o CSV para ver todos.</p> : null}
      </Card>
    </div>
  );
}
