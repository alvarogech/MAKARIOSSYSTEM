import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Calendar, MapPin } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadTeacherHomeSummary, type TeacherLesson } from "@/modules/teaching/teacherHome";
import { TeacherClassCardView } from "@/modules/teaching/components/TeacherClassCardView";
import { loadPendingReports } from "@/modules/teaching/pendingReports";

export const metadata: Metadata = { title: "Área do professor" };

export default async function ProfessorHomePage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();
  const summary = await loadTeacherHomeSummary(supabase, authContext.userId);
  const pendingReports = await loadPendingReports(supabase, authContext.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Olá, {authContext.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Sua próxima aula e o que precisa da sua atenção agora.</p>
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

      {pendingReports.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <h2 className="font-semibold text-neutral-900">Relatório pós-aula pendente</h2>
          <p className="mt-0.5 text-sm text-neutral-600">São só 3 campos curtos — leva um minuto.</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
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
        </Card>
      ) : null}

      {/* A. Próxima aula */}
      {summary.nextLesson ? (
        <NextLessonCard lesson={summary.nextLesson} sameDayLessons={summary.todayOtherLessons} />
      ) : (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Próxima aula</p>
          <p className="mt-2 text-sm text-neutral-500">
            Você ainda não tem nenhuma aula específica atribuída pela coordenação. Assim que uma escala for
            definida para uma das suas turmas, ela aparece aqui.
          </p>
        </Card>
      )}

      {/* B. Próximas aulas */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Próximas aulas</h2>
          <Link href="/professor/agenda" className="text-sm text-brand-blue hover:underline">
            Ver agenda completa
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {summary.upcomingLessons.slice(0, 5).map((lesson) => (
            <li key={lesson.blockId} className="flex items-center justify-between gap-3 py-2">
              <span className="text-neutral-700">
                {lesson.dateLabel} · {lesson.timeLabel} — {lesson.moduleName ?? "Tema a definir"}
                <span className="text-neutral-400"> · {lesson.volumeName} · {lesson.className}</span>
              </span>
              <Link href={`/professor/aulas/${lesson.blockId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Preparar
              </Link>
            </li>
          ))}
          {summary.upcomingLessons.length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhuma outra aula atribuída no momento.</li>
          ) : null}
        </ul>
      </Card>

      {/* C. Avisos da coordenação */}
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

      {/* D. Minhas turmas */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Minhas turmas</h2>
          {summary.classes.length > 0 ? (
            <Link href="/professor/turmas" className="text-sm text-brand-blue hover:underline">
              Ver todas
            </Link>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {summary.classes.map((klass) => (
            <TeacherClassCardView key={klass.classId} klass={klass} />
          ))}
          {summary.classes.length === 0 ? (
            <p className="text-sm text-neutral-400">Você ainda não tem nenhuma turma vinculada.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function NextLessonCard({ lesson, sameDayLessons }: { lesson: TeacherLesson; sameDayLessons: TeacherLesson[] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Próxima aula</p>
            {lesson.isHappeningNow ? (
              <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Em andamento
              </span>
            ) : lesson.isToday ? (
              <span className="rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Aula de hoje
              </span>
            ) : null}
            {lesson.blockStatus === "changed" ? (
              <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Alterada</span>
            ) : null}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-neutral-900">{lesson.moduleName ?? "Tema a definir"}</h2>
          <p className="text-sm text-neutral-600">{lesson.volumeName} · {lesson.className}</p>
          <p className="mt-1 text-sm text-neutral-600">
            {lesson.dateLabel} · {lesson.timeLabel}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {lesson.locationLabel ?? "Local a confirmar"}
            {lesson.room ? ` · Sala ${lesson.room}` : " · Sala a confirmar"}
          </p>

          {sameDayLessons.length > 0 ? (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-neutral-100 bg-neutral-50 p-2.5">
              <p className="text-xs font-medium text-neutral-500">Você também tem hoje:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {sameDayLessons.map((other) => (
                  <li key={other.blockId} className="text-xs text-neutral-600">
                    {other.timeLabel} — {other.moduleName ?? "Tema a definir"} ({other.className})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <Calendar className="size-8 shrink-0 text-brand-blue" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/professor/aulas/${lesson.blockId}`} className={buttonVariants({ variant: "primary", size: "sm" })}>
          Preparar aula
        </Link>
        <Link
          href={`/professor/turmas/${lesson.classId}/encontros/${lesson.meetingId}/frequencia`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Ver presença
        </Link>
        <Link
          href={`/professor/turmas/${lesson.classId}/encontros/${lesson.meetingId}/relatorio`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Enviar relatório
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
