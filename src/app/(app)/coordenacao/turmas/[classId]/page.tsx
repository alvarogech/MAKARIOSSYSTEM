import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classContext } from "@/modules/academic/classHub";
import { formatHours } from "@/modules/attendance/progress";
import { SITUATION } from "@/modules/attendance/situation";
import { loadOverview } from "@/modules/attendance/overviewLoader";

export const metadata: Metadata = { title: "Turma" };

const day = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

export default async function TurmaVisaoPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await classContext(supabase, classId);
  if (!ctx) notFound();

  const [{ overview }, { data: meetings }, { data: blocks }] = await Promise.all([
    loadOverview(supabase, ctx.seasonId, { classId }),
    supabase.from("class_meetings").select("id, sequence, meeting_date, start_time, end_time, status").eq("class_id", classId).order("meeting_date"),
    supabase.from("class_meeting_blocks").select("class_meeting_id, teacher_id, status"),
  ]);

  const klass = overview.classes[0];
  const withTeacher = new Set((blocks ?? []).filter((b) => b.teacher_id && b.status !== "canceled").map((b) => b.class_meeting_id));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const upcoming = (meetings ?? []).filter((m) => m.meeting_date && m.meeting_date >= today && m.status !== "canceled").slice(0, 4);
  const noTeacher = (meetings ?? []).filter((m) => m.meeting_date && m.status !== "canceled" && !withTeacher.has(m.id));
  const people = klass?.people ?? [];
  const waiting = people.filter((p) => p.stage === "aguardando_acesso").length;
  const risk = people.filter((p) => p.progress.situation === "reprovado" || p.progress.situation === "no_limite");
  const lastHeld = [...(klass?.meetings ?? [])].filter((m) => m.past).sort((a, b) => b.sequence - a.sequence)[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-1">
        <h2 className="font-semibold text-neutral-900">Alunos</h2>
        <p className="text-2xl font-semibold text-neutral-900">{people.length}</p>
        <p className="text-sm text-neutral-500">
          {people.length - waiting} matriculados · {waiting} aguardando criar a conta
        </p>
        <Link href={`/coordenacao/turmas/${classId}/alunos`} className="mt-1 text-sm font-medium text-brand-blue hover:underline">
          Ver lista →
        </Link>
      </Card>

      <Card className="flex flex-col gap-1">
        <h2 className="font-semibold text-neutral-900">Presença</h2>
        <p className="text-2xl font-semibold text-neutral-900">{klass?.avgPct != null ? `${klass.avgPct}%` : "—"}</p>
        <p className="text-sm text-neutral-500">
          média dos encontros realizados{lastHeld?.pct != null ? ` · último (E${lastHeld.sequence}): ${Math.round(lastHeld.pct)}%` : ""}
        </p>
        <Link href={`/coordenacao/turmas/${classId}/presenca`} className="mt-1 text-sm font-medium text-brand-blue hover:underline">
          Ver encontro a encontro →
        </Link>
      </Card>

      <Card className="flex flex-col gap-1">
        <h2 className="font-semibold text-neutral-900">Próximos encontros</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum encontro futuro.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-neutral-700">
            {upcoming.map((m) => (
              <li key={m.id}>
                E{m.sequence} · {day(m.meeting_date!)} · {m.start_time?.slice(0, 5)} às {m.end_time?.slice(0, 5)}
                {!withTeacher.has(m.id) ? <span className="ml-2 font-medium text-danger">sem professor</span> : null}
              </li>
            ))}
          </ul>
        )}
        {noTeacher.length > 0 ? (
          <Link href={`/coordenacao/turmas/${classId}/escala`} className="mt-1 text-sm font-medium text-danger hover:underline">
            {noTeacher.length} encontro(s) sem professor — abrir escala →
          </Link>
        ) : (
          <Link href={`/coordenacao/turmas/${classId}/escala`} className="mt-1 text-sm font-medium text-brand-blue hover:underline">
            Abrir escala →
          </Link>
        )}
      </Card>

      <Card className="flex flex-col gap-1">
        <h2 className="font-semibold text-neutral-900">Em risco ({risk.length})</h2>
        {risk.length === 0 ? (
          <p className="text-sm text-neutral-400">Ninguém em risco por enquanto.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {risk.slice(0, 6).map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-2">
                <span className="text-neutral-800">{p.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUATION[p.progress.situation].className}`}>
                  {formatHours(p.progress.attendedMinutes)} · {SITUATION[p.progress.situation].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
