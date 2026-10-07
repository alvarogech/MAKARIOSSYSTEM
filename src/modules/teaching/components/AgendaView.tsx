"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { classScheduleLabel } from "@/lib/classLabel";
import { formatRoom } from "@/lib/room";
import { trailStyle } from "@/lib/trail";
import type { AgendaAction, LessonPhase } from "../agendaView";

export interface AgendaLessonView {
  blockId: string;
  classId: string;
  dateKey: string;
  dayLabel: string;
  timeLabel: string;
  moduleName: string | null;
  volumeName: string;
  className: string;
  room: string | null;
  phase: LessonPhase;
  canceled: boolean;
  changed: boolean;
  isNext: boolean;
  action: AgendaAction | null;
}

const monthKeyOf = (dateKey: string) => dateKey.slice(0, 7);
const shiftMonth = (monthKey: string, delta: number) => {
  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (monthKey: string) => {
  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
        active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
      }`}
    >
      {children}
    </button>
  );
}

function LessonRow({ lesson }: { lesson: AgendaLessonView }) {
  const style = trailStyle(lesson.volumeName);
  const muted = lesson.phase === "over" || lesson.canceled;
  const room = formatRoom(lesson.room);
  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 py-3 ${muted ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`font-medium text-neutral-900 ${lesson.canceled ? "line-through" : ""}`}>{lesson.moduleName ?? "Tema a definir"}</span>
          {lesson.isNext ? <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Próxima</span> : null}
          {lesson.canceled ? <span className="text-xs font-semibold text-danger">cancelada</span> : null}
          {lesson.changed ? <span className="text-xs font-semibold text-warning">alterada</span> : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${style.tag}`}>
            <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
            {lesson.volumeName} · {classScheduleLabel(lesson.className)}
          </span>
          <span>{lesson.timeLabel}</span>
          {room ? <span>· {room}</span> : null}
        </p>
      </div>
      {lesson.action ? (
        <Link href={lesson.action.href} className={buttonVariants({ variant: lesson.isNext ? "primary" : "ghost", size: "sm" })}>
          {lesson.action.label}
        </Link>
      ) : null}
    </li>
  );
}

function MonthGrid({ month, lessons }: { month: string; lessons: AgendaLessonView[] }) {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const offset = first.getUTCDay(); // domingo = 0
  const cells: (number | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const byDay = new Map<string, AgendaLessonView[]>();
  for (const l of lessons) byDay.set(l.dateKey, [...(byDay.get(l.dateKey) ?? []), l]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-neutral-500" aria-hidden="true">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1" aria-label={`Calendário de ${monthLabel(month)}`}>
        {cells.map((day, i) => {
          if (day === null) return <li key={`e${i}`} aria-hidden="true" />;
          const key = `${month}-${String(day).padStart(2, "0")}`;
          const items = byDay.get(key) ?? [];
          return (
            <li key={key} className="flex min-h-16 flex-col items-center gap-0.5 rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-1">
              <span className="text-xs font-semibold text-neutral-700">{day}</span>
              {items.map((l) => {
                const style = trailStyle(l.volumeName);
                return (
                  <Link
                    key={l.blockId}
                    href={l.action?.href ?? `/professor/aulas/${l.blockId}`}
                    title={`${l.timeLabel} · ${l.moduleName ?? "Tema a definir"} · ${l.volumeName}`}
                    className={`flex w-full items-center justify-center gap-0.5 rounded px-0.5 py-0.5 text-[10px] font-medium leading-tight ${style.tag} ${l.phase === "over" || l.canceled ? "opacity-50" : ""}`}
                  >
                    <span aria-hidden="true" className={`size-1 rounded-full ${style.dot}`} />
                    {l.timeLabel.split(" ")[0]}
                  </Link>
                );
              })}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Agenda do professor: filtros instantâneos (sem botão "Filtrar"), Lista/Mês e uma ação por aula. */
export function AgendaView({ lessons, initialMonth }: { lessons: AgendaLessonView[]; initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<"lista" | "mes">("lista");
  const [trail, setTrail] = useState<string | null>(null);
  const [turma, setTurma] = useState<string | null>(null);

  const trails = useMemo(() => [...new Set(lessons.map((l) => l.volumeName))], [lessons]);
  const turmas = useMemo(() => [...new Set(lessons.map((l) => classScheduleLabel(l.className)))], [lessons]);

  const visible = useMemo(
    () =>
      lessons.filter(
        (l) => monthKeyOf(l.dateKey) === month && (!trail || l.volumeName === trail) && (!turma || classScheduleLabel(l.className) === turma),
      ),
    [lessons, month, trail, turma],
  );

  const days = [...new Set(visible.map((l) => l.dateKey))].sort();
  const todayMonth = initialMonth;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))} className={`${buttonVariants({ variant: "ghost", size: "sm" })} !px-2`}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-36 text-center text-sm font-semibold text-neutral-900" aria-live="polite">
            {monthLabel(month)}
          </span>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))} className={`${buttonVariants({ variant: "ghost", size: "sm" })} !px-2`}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          {month !== todayMonth ? (
            <button type="button" onClick={() => setMonth(todayMonth)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Hoje
            </button>
          ) : null}
        </div>
        <div role="group" aria-label="Modo de exibição" className="inline-flex overflow-hidden rounded-full border border-neutral-200 bg-white text-sm">
          {(["lista", "mes"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-9 px-4 font-medium focus-visible:outline-2 focus-visible:outline-brand-blue ${view === v ? "bg-neutral-900 text-white" : "text-neutral-600"}`}
            >
              {v === "lista" ? "Lista" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {trails.length > 1 || turmas.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros">
          {trails.length > 1 ? (
            <>
              <Chip active={trail === null} onClick={() => setTrail(null)}>
                Todas as trilhas
              </Chip>
              {trails.map((t) => (
                <Chip key={t} active={trail === t} onClick={() => setTrail(trail === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </>
          ) : null}
          {turmas.length > 1 ? (
            <>
              <span className="mx-1 hidden w-px bg-neutral-200 sm:block" aria-hidden="true" />
              {turmas.map((t) => (
                <Chip key={t} active={turma === t} onClick={() => setTurma(turma === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {view === "mes" ? (
        <Card className="p-3 sm:p-4">
          <MonthGrid month={month} lessons={visible} />
        </Card>
      ) : days.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Nenhuma aula sua neste mês{trail || turma ? " com esses filtros" : ""}.</p>
        </Card>
      ) : (
        days.map((dayKey) => {
          const dayLessons = visible.filter((l) => l.dateKey === dayKey);
          return (
            <Card key={dayKey} className="p-4">
              <h3 className="text-sm font-semibold text-neutral-900">{dayLessons[0]?.dayLabel}</h3>
              <ul className="mt-1 divide-y divide-neutral-100">
                {dayLessons.map((lesson) => (
                  <LessonRow key={lesson.blockId} lesson={lesson} />
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
}
