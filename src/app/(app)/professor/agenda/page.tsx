import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { loadTeacherAgenda } from "@/modules/teaching/teacherAgenda";
import type { TeacherLesson } from "@/modules/teaching/teacherHome";

export const metadata: Metadata = { title: "Agenda do professor" };

function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function ProfessorAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; classId?: string; moduleId?: string }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const { month, classId, moduleId } = await searchParams;
  const todayKey = getSaoPauloDateKey(new Date());
  const currentMonth = month ?? monthKeyOf(todayKey);

  const supabase = await createSupabaseServerClient();
  const agenda = await loadTeacherAgenda(supabase, authContext.userId);

  const filteredLessons = agenda.lessons.filter((lesson) => {
    if (!lesson.meetingDateKey || monthKeyOf(lesson.meetingDateKey) !== currentMonth) return false;
    if (classId && lesson.classId !== classId) return false;
    if (moduleId && lesson.moduleName !== agenda.moduleOptions.find((m) => m.id === moduleId)?.name) return false;
    return true;
  });

  const filteredMeetingsAwaiting = agenda.meetingsAwaitingSchedule.filter((m) => {
    // Sem data, não pertence a nenhum mês específico — sempre mostrado.
    return classId ? m.classId === classId : true;
  });

  const lessonsByDay = new Map<string, TeacherLesson[]>();
  for (const lesson of filteredLessons) {
    if (!lesson.meetingDateKey) continue;
    const list = lessonsByDay.get(lesson.meetingDateKey) ?? [];
    list.push(lesson);
    lessonsByDay.set(lesson.meetingDateKey, list);
  }
  const days = [...lessonsByDay.keys()].sort();

  function buildHref(overrides: Record<string, string | null>): string {
    const params = new URLSearchParams();
    const next = { month: currentMonth, classId, moduleId, ...overrides };
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/professor/agenda?${query}` : "/professor/agenda";
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Agenda</h1>
        <p className="mt-1 text-sm text-neutral-500">Todos os horários em português brasileiro, fuso de São Paulo.</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={buildHref({ month: shiftMonth(currentMonth, -1) })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              ← Mês anterior
            </Link>
            <span className="text-sm font-medium text-neutral-700">{formatMonthLabel(currentMonth)}</span>
            <Link href={buildHref({ month: shiftMonth(currentMonth, 1) })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Próximo mês →
            </Link>
          </div>
          <Link href={buildHref({ month: monthKeyOf(todayKey) })} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Hoje
          </Link>
        </div>

        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="month" value={currentMonth} />
          <div>
            <label htmlFor="classId" className="text-xs font-medium text-neutral-500">Turma</label>
            <select id="classId" name="classId" defaultValue={classId ?? ""} className="mt-1 block h-9 rounded-[var(--radius-sm)] border border-neutral-200 px-2 text-sm">
              <option value="">Todas as turmas</option>
              {agenda.classOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="moduleId" className="text-xs font-medium text-neutral-500">Módulo</label>
            <select id="moduleId" name="moduleId" defaultValue={moduleId ?? ""} className="mt-1 block h-9 rounded-[var(--radius-sm)] border border-neutral-200 px-2 text-sm">
              <option value="">Todos os módulos</option>
              {agenda.moduleOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Filtrar
          </button>
        </form>
      </Card>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Minhas aulas</h2>
      </div>

      {days.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-400">Nenhuma aula sua neste mês.</p>
        </Card>
      ) : (
        days.map((dayKey) => {
          const dayLessons = lessonsByDay.get(dayKey) ?? [];
          return (
            <Card key={dayKey}>
              <h3 className="font-semibold text-neutral-900">{dayLessons[0]?.dateLabel}</h3>
              <ul className="mt-2 divide-y divide-neutral-100 text-sm">
                {dayLessons.map((lesson) => (
                  <li key={lesson.blockId} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      {lesson.meetingDateKey && lesson.meetingDateKey < todayKey ? (
                        <CalendarCheck className="size-4 shrink-0 text-neutral-300" aria-hidden="true" />
                      ) : (
                        <CalendarClock className={`size-4 shrink-0 ${lesson.isToday ? "text-brand-blue" : "text-neutral-400"}`} aria-hidden="true" />
                      )}
                      <span className={lesson.meetingDateKey && lesson.meetingDateKey < todayKey ? "text-neutral-400" : "text-neutral-700"}>
                        {lesson.timeLabel} — {lesson.moduleName ?? "Tema a definir"}
                        <span className="text-neutral-400"> · {lesson.volumeName} · {lesson.className}</span>
                        {lesson.blockStatus === "canceled" ? <span className="ml-1 text-xs font-semibold text-danger"> · cancelada</span> : null}
                        {lesson.blockStatus === "changed" ? <span className="ml-1 text-xs font-semibold text-warning"> · alterada</span> : null}
                      </span>
                    </span>
                    <Link href={`/professor/aulas/${lesson.blockId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      {lesson.meetingDateKey && lesson.meetingDateKey < todayKey ? "Ver detalhes" : "Preparar"}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Encontros das minhas turmas</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Encontros de turmas às quais você tem vínculo, mas cuja escala por aula ainda não foi definida pela coordenação.
        </p>
      </div>
      <Card>
        {filteredMeetingsAwaiting.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum encontro pendente de escala no momento.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {filteredMeetingsAwaiting.map((meeting) => (
              <li key={meeting.meetingId} className="py-2 text-neutral-600">
                {meeting.dateLabel} · {meeting.timeLabel} — {meeting.volumeName} · {meeting.className}
                <span className="ml-1 text-xs text-neutral-400">— escala ainda não definida</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
