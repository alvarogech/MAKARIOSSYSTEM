/** Montagem pura da agenda: fase de cada aula, ação única por linha e a "Próxima". Sem banco, testável. */
import { isMeetingOver } from "./reportSettings";

export type LessonPhase = "future" | "today" | "over";

export interface AgendaLessonInput {
  blockId: string;
  meetingId: string;
  classId: string;
  dateKey: string | null;
  endTime: string | null;
  startTime: string | null;
  blockStatus: string;
  meetingStatus: string;
}

export interface AgendaAction {
  label: "Preparar" | "Relatório" | "Ver resumo";
  href: string;
}

export interface AgendaLessonState {
  phase: LessonPhase;
  canceled: boolean;
  isNext: boolean;
  action: AgendaAction | null;
}

/**
 * Ação contextual única por linha, conforme o tempo: Preparar (antes e durante o dia) →
 * Relatório (depois, só se o semestre exige e ainda não foi enviado) → Ver resumo.
 */
export function buildAgendaStates(
  lessons: AgendaLessonInput[],
  ctx: { todayKey: string; now: Date; reportActiveByClass: Map<string, boolean>; reportedMeetingIds: Set<string> },
): Map<string, AgendaLessonState> {
  const result = new Map<string, AgendaLessonState>();
  let nextAssigned = false;

  const ordered = [...lessons].sort((a, b) => `${a.dateKey ?? ""}${a.startTime ?? ""}`.localeCompare(`${b.dateKey ?? ""}${b.startTime ?? ""}`));

  for (const lesson of ordered) {
    const canceled = lesson.blockStatus === "canceled" || lesson.meetingStatus === "canceled";
    const over = isMeetingOver(lesson.dateKey, lesson.endTime, ctx.now);
    const phase: LessonPhase = over ? "over" : lesson.dateKey === ctx.todayKey ? "today" : lesson.dateKey && lesson.dateKey > ctx.todayKey ? "future" : "over";

    let action: AgendaAction | null = null;
    if (!canceled) {
      if (phase === "over") {
        const needsReport = (ctx.reportActiveByClass.get(lesson.classId) ?? false) && !ctx.reportedMeetingIds.has(lesson.meetingId);
        action = needsReport
          ? { label: "Relatório", href: `/professor/turmas/${lesson.classId}/encontros/${lesson.meetingId}/relatorio` }
          : { label: "Ver resumo", href: `/professor/aulas/${lesson.blockId}` };
      } else {
        action = { label: "Preparar", href: `/professor/aulas/${lesson.blockId}` };
      }
    }

    const isNext = !canceled && phase !== "over" && !nextAssigned;
    if (isNext) nextAssigned = true;
    result.set(lesson.blockId, { phase, canceled, isNext, action });
  }
  return result;
}
