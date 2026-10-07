import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classContext } from "@/modules/academic/classHub";
import { Heatmap, LessonBars } from "@/modules/attendance/components/OverviewCharts";
import { loadOverview } from "@/modules/attendance/overviewLoader";

export const metadata: Metadata = { title: "Presença da turma" };

const day = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

export default async function TurmaPresencaPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await classContext(supabase, classId);
  if (!ctx) notFound();

  const { overview, maxSequence } = await loadOverview(supabase, ctx.seasonId, { classId });
  const klass = overview.classes[0];
  const anomalies = overview.anomalies;

  return (
    <div className="flex flex-col gap-4">
      {anomalies.length > 0 ? (
        <Card className="border-danger/30 bg-danger/5">
          <h2 className="text-sm font-semibold text-danger">Possíveis falhas nesta turma</h2>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-neutral-800">
            {anomalies.map((a, i) => (
              <li key={i}>{a.text}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-900">Encontro a encontro</h2>
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {(klass?.meetings ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-neutral-800">
                Encontro {m.sequence} · {day(m.date)}
              </span>
              <span className="text-neutral-600">
                {m.past ? (
                  <>
                    <strong className="text-neutral-900">{m.pct === null ? "—" : `${Math.round(m.pct)}%`}</strong> ({m.present} de {m.rosterSize}) · QR {m.qrCount} · manual{" "}
                    {m.manualCount} · autodeclaração {m.declaredCount}
                  </>
                ) : (
                  <span className="text-neutral-400">ainda não aconteceu</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {klass ? (
        <>
          <Card>
            <h2 className="mb-2 font-semibold text-neutral-900">Mapa de calor</h2>
            <Heatmap classes={[klass]} maxSequence={maxSequence} />
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold text-neutral-900">Presença por aula no último encontro</h2>
            <LessonBars classes={[klass]} />
          </Card>
        </>
      ) : null}

      <Link href={`/coordenacao/presenca?aba=dia&temporada=${ctx.seasonId}`} className="text-sm font-medium text-brand-blue hover:underline">
        Abrir o relatório do dia (quem veio, reposição e faltas) →
      </Link>
    </div>
  );
}
