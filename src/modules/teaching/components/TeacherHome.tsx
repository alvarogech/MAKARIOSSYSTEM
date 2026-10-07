import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, FileText, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { formatSaoPauloLongDate } from "@/lib/saoPauloDate";
import { formatRoom } from "@/lib/room";
import { classTagLabel } from "@/lib/classLabel";
import type { TeacherLesson } from "../teacherHome";
import type { TeacherDashboardData } from "../teacherDashboard";
import { countdownLabel, weekStrip } from "../teacherDashboardLogic";
import { TeacherClassCardView } from "./TeacherClassCardView";

/** Início do professor: o que fazer agora em poucos segundos. */
export function TeacherHome({ firstName, data, todayKey }: { firstName: string; data: TeacherDashboardData; todayKey: string }) {
  const { summary, pendingReports, indicators, newMaterials } = data;
  const weekLessons = [summary.nextLesson, ...summary.todayOtherLessons, ...summary.upcomingLessons].filter(
    (l): l is TeacherLesson => Boolean(l),
  );
  const week = weekStrip(
    todayKey,
    weekLessons.map((l) => ({ dateKey: l.meetingDateKey, lesson: l })),
  );
  const nothingPending = pendingReports.length === 0 && newMaterials.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Olá, {firstName}</h1>
        <p className="mt-0.5 text-sm text-neutral-500">{formatSaoPauloLongDate(todayKey, { capitalize: true })}</p>
      </div>

      {summary.conflicts.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm text-neutral-700">
              <p className="font-medium">Possível conflito de horário</p>
              {summary.conflicts.map((conflict) => (
                <p key={conflict.dateKey} className="mt-1 text-neutral-600">
                  {conflict.dateKey.split("-").reverse().join("/")}:{" "}
                  {conflict.blocks.map((b) => `${b.label} (${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)})`).join(" e ")}
                </p>
              ))}
              <p className="mt-1 text-xs text-neutral-500">Procure a coordenação para confirmar sua escala.</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Próxima aula */}
      {summary.nextLesson ? (
        <NextLesson lesson={summary.nextLesson} sameDay={summary.todayOtherLessons} todayKey={todayKey} />
      ) : (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Próxima aula</p>
          <p className="mt-2 text-sm text-neutral-600">
            Você ainda não tem aula atribuída pela coordenação. Assim que a escala for definida, ela aparece aqui.
          </p>
        </Card>
      )}

      {/* Pendências */}
      <section aria-labelledby="pendencias">
        <h2 id="pendencias" className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Pendências
        </h2>
        {nothingPending ? (
          <Card className="flex items-center gap-2 text-sm text-neutral-700">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" /> Tudo em dia.
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            {pendingReports.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-neutral-900">Relatório pós-aula pendente</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {pendingReports.slice(0, 4).map((r) => (
                    <li key={r.meetingId}>
                      <Link
                        href={`/professor/turmas/${r.classId}/encontros/${r.meetingId}/relatorio`}
                        className="text-brand-blue hover:underline"
                      >
                        {r.className} · encontro {r.sequence} · {r.date.split("-").reverse().slice(0, 2).join("/")} → enviar
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {newMaterials.length > 0 ? (
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                  <FileText className="size-4 text-neutral-400" aria-hidden="true" />
                  {newMaterials.length === 1 ? "Material novo publicado" : "Materiais novos publicados"} (últimos 7 dias)
                </p>
                <ul className="mt-1 list-disc pl-6 text-sm text-neutral-600">
                  {newMaterials.map((m) => (
                    <li key={m.id}>{m.title}</li>
                  ))}
                </ul>
                <Link href="/professor/turmas" className="mt-1 inline-block text-sm text-brand-blue hover:underline">
                  Ver nas minhas turmas →
                </Link>
              </div>
            ) : null}
          </Card>
        )}
      </section>

      {/* Semana */}
      <section aria-labelledby="semana">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="semana" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Próximos 7 dias
          </h2>
          <Link href="/professor/agenda" className="text-sm text-brand-blue hover:underline">
            Agenda completa
          </Link>
        </div>
        <ol className="grid grid-cols-7 gap-1.5">
          {week.map((day) => (
            <li
              key={day.dateKey}
              className={`flex min-h-24 flex-col items-center gap-1 rounded-[var(--radius-sm)] border p-1.5 text-center ${
                day.isToday ? "border-brand-blue bg-brand-blue-light" : "border-neutral-200 bg-white"
              }`}
            >
              <span className="text-[11px] uppercase text-neutral-500">{day.weekday}</span>
              <span className={`text-base font-semibold ${day.isToday ? "text-brand-blue" : "text-neutral-900"}`}>{day.dayNumber}</span>
              {day.items.length === 0 ? (
                <span className="sr-only">Sem aula</span>
              ) : (
                day.items.map(({ lesson }) => (
                  <Link
                    key={lesson.blockId}
                    href={`/professor/aulas/${lesson.blockId}`}
                    title={`${lesson.timeLabel} · ${lesson.moduleName ?? "Tema a definir"} · ${lesson.className}`}
                    className="w-full rounded bg-brand-blue px-0.5 py-0.5 text-[10px] font-medium leading-tight text-white hover:bg-brand-blue-dark"
                  >
                    {lesson.timeLabel.split(" ")[0]}
                  </Link>
                ))
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Indicadores discretos */}
      <section aria-labelledby="numeros">
        <h2 id="numeros" className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Suas turmas em números
        </h2>
        <dl className="grid grid-cols-3 gap-2">
          <Stat
            label="Alunos em atenção"
            value={indicators.attention === null ? "Sem dados" : String(indicators.attention)}
            hint="no limite ou abaixo dos 75%"
          />
          <Stat
            label="Frequência média"
            value={indicators.averagePercent === null ? "Sem dados" : `${indicators.averagePercent}%`}
            hint="das aulas já realizadas"
          />
          <Stat
            label="Aulas suas"
            value={indicators.lessonsPlanned === 0 ? "Sem dados" : `${indicators.lessonsDone} de ${indicators.lessonsPlanned}`}
            hint="dadas / previstas"
          />
        </dl>
      </section>

      {/* Avisos */}
      {summary.announcements.length > 0 ? (
        <Card>
          <h2 className="font-semibold text-neutral-900">Avisos da coordenação</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {summary.announcements.map((announcement) => (
              <li key={announcement.id} className="border-t border-neutral-100 pt-3 first:border-none first:pt-0">
                <p className="text-sm font-medium text-neutral-900">{announcement.title}</p>
                <p className="mt-0.5 text-sm text-neutral-600">{announcement.body}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  {announcement.publishedLabel} · {announcement.scopeLabel}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Turmas */}
      <section aria-labelledby="turmas">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="turmas" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Minhas turmas
          </h2>
          {summary.classes.length > 0 ? (
            <Link href="/professor/turmas" className="text-sm text-brand-blue hover:underline">
              Ver todas
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {summary.classes.map((klass) => (
            <TeacherClassCardView key={klass.classId} klass={klass} />
          ))}
          {summary.classes.length === 0 ? <p className="text-sm text-neutral-500">Você ainda não tem turma vinculada.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`mt-1 font-semibold text-neutral-900 ${value === "Sem dados" ? "text-sm text-neutral-400" : "text-xl"}`}>{value}</dd>
      <dd className="mt-0.5 text-[11px] text-neutral-400">{hint}</dd>
    </div>
  );
}

function NextLesson({ lesson, sameDay, todayKey }: { lesson: TeacherLesson; sameDay: TeacherLesson[]; todayKey: string }) {
  const countdown = lesson.meetingDateKey ? countdownLabel(lesson.meetingDateKey, lesson.sortStartTime, todayKey) : null;
  const room = formatRoom(lesson.room);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Próxima aula</p>
            {lesson.isHappeningNow ? (
              <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Em andamento</span>
            ) : countdown ? (
              <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-xs font-medium text-brand-blue">{countdown}</span>
            ) : null}
            {lesson.blockStatus === "changed" ? (
              <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Alterada</span>
            ) : null}
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">{lesson.moduleName ?? "Tema a definir"}</h2>
          <p className="text-sm text-neutral-600">{classTagLabel(lesson.volumeName, lesson.className)}</p>
          <p className="mt-1 text-sm text-neutral-600">
            {lesson.dateLabel} · {lesson.timeLabel}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {lesson.locationLabel ?? "Local a confirmar"}
            {room ? ` · ${room}` : ""}
          </p>

          {sameDay.length > 0 ? (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-neutral-100 bg-neutral-50 p-2.5">
              <p className="text-xs font-medium text-neutral-500">Você também tem neste dia:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {sameDay.map((other) => (
                  <li key={other.blockId} className="text-xs text-neutral-600">
                    {other.timeLabel} — {other.moduleName ?? "Tema a definir"} ({classTagLabel(other.volumeName, other.className)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <CalendarDays className="hidden size-8 shrink-0 text-neutral-300 sm:block" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/professor/aulas/${lesson.blockId}`} className={buttonVariants({ variant: "primary", size: "sm" })}>
          Abrir material e preparar
        </Link>
        {lesson.mapsUrl ? (
          <a href={lesson.mapsUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Ver localização
          </a>
        ) : null}
        {lesson.canExportCalendar ? (
          <a href={`/api/professor/aulas/${lesson.blockId}/ics`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Adicionar ao calendário
          </a>
        ) : null}
      </div>
    </Card>
  );
}
