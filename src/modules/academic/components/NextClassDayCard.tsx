import Link from "next/link";
import { BookOpen, CalendarDays, Clock, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { formatDayHeading, pluralize, type NextClassDay, type UpcomingMeeting } from "../nextClassDay";

const HEADING_ID = "proximo-dia-de-aula";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue";

function Names({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) return <span className="italic text-neutral-500">{empty}</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {values.map((value) => (
        <li key={value} className="break-words">
          {value}
        </li>
      ))}
    </ul>
  );
}

function MeetingItem({ meeting }: { meeting: UpcomingMeeting }) {
  const heading = [meeting.volumeName ?? meeting.className, meeting.scheduleLabel, `Encontro ${meeting.sequence}`].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-base font-semibold text-neutral-900">
          <Clock className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>
            <time dateTime={meeting.start}>{meeting.start}</time> às <time dateTime={meeting.end}>{meeting.end}</time>
          </span>
        </p>
        {meeting.timeState === "ongoing" ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Em andamento</span>
        ) : null}
      </div>

      <p className="break-words text-sm font-medium text-neutral-800">{heading}</p>

      <dl className="flex flex-col gap-2 text-sm text-neutral-700">
        <div className="flex gap-2">
          <dt className="mt-0.5 shrink-0 text-neutral-400">
            <BookOpen className="size-4" aria-hidden="true" />
            <span className="sr-only">{meeting.subjects.length === 1 ? "Matéria" : "Matérias"}</span>
          </dt>
          <dd className="min-w-0">
            <Names values={meeting.subjects} empty="Matéria não informada" />
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="mt-0.5 shrink-0 text-neutral-400">
            <User className="size-4" aria-hidden="true" />
            <span className="sr-only">{meeting.teachers.length === 1 ? "Professor" : "Professores"}</span>
          </dt>
          <dd className="min-w-0">
            <Names values={meeting.teachers} empty="Professor não definido" />
            {meeting.teachers.length === 0 ? (
              <Link href={`/coordenacao/turmas/${meeting.classId}/escala`} className={`ml-2 text-xs font-medium text-danger hover:underline ${focusRing}`}>
                Atribuir
              </Link>
            ) : null}
          </dd>
        </div>
      </dl>

      <div>
        <Link
          href={`/coordenacao/turmas/${meeting.classId}`}
          aria-label={`Ver turma: ${meeting.className}`}
          className={`${buttonVariants({ variant: "secondary", size: "sm" })} ${focusRing}`}
        >
          Ver turma
        </Link>
      </div>
    </li>
  );
}

/** Destaque do início da coordenação: a próxima data com aula e todas as turmas dela. */
export function NextClassDayCard({ day, failed = false, todayKey }: { day: NextClassDay | null; failed?: boolean; todayKey: string }) {
  return (
    <Card role="region" aria-labelledby={HEADING_ID} className="border-l-4 border-l-brand-blue p-5 sm:p-6">
      <h2 id={HEADING_ID} className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
        Próximo dia de aula
      </h2>

      {day ? (
        <>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xl font-semibold text-neutral-900 sm:text-2xl">
              <time dateTime={day.date}>{formatDayHeading(day.date, todayKey)}</time>
            </p>
            {day.isToday ? <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-xs font-semibold text-white">Hoje</span> : null}
            <span className="text-sm text-neutral-500">{pluralize(day.meetings.length, "turma", "turmas")}</span>
          </div>
          <ul className={`mt-4 grid gap-3 ${day.meetings.length > 1 ? "md:grid-cols-2" : ""}`}>
            {day.meetings.map((meeting) => (
              <MeetingItem key={meeting.meetingId} meeting={meeting} />
            ))}
          </ul>
        </>
      ) : failed ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600" role="status">
          <CalendarDays className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <span>Não foi possível carregar o próximo dia de aula agora.</span>
          <a href="/dashboard" className={`font-medium text-brand-blue hover:underline ${focusRing}`}>
            Tentar novamente
          </a>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
          <CalendarDays className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          Nenhuma aula programada no momento.
        </p>
      )}
    </Card>
  );
}
