import { LESSON_MINUTES, meetingBlocks, toMinutes, type MeetingTimes } from "./rules";

/** Antecedência com que uma aula já pode ser marcada (a pessoa chega e marca antes de começar). */
export const MARK_OPENS_BEFORE_MINUTES = 30;

export interface DayLessonInfo {
  /** Numeração do encontro: 1 a 4 (terça/quinta) ou 1 a 8 (sábado); o bloco 2 continua a do bloco 1. */
  number: number;
  block: 1 | 2;
  /** "HH:MM" */
  start: string;
  end: string;
  startMinute: number;
  subject: string | null;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * As aulas de 30 min de um encontro, na ordem, cada uma com seu horário e a
 * matéria que está sendo dada naquele horário (quando a coordenação já montou
 * a escala do encontro).
 */
export function dayLessons(
  meeting: MeetingTimes,
  subjects: { start: number; end: number; name: string }[] = [],
): DayLessonInfo[] {
  const lessons: DayLessonInfo[] = [];
  let number = 0;
  for (const block of meetingBlocks(meeting)) {
    for (let i = 0; i < block.lessons; i++) {
      number += 1;
      const start = block.start + i * LESSON_MINUTES;
      const end = start + LESSON_MINUTES;
      const subject = subjects.find((s) => s.start <= start && start < s.end)?.name ?? null;
      lessons.push({ number, block: block.block, start: hhmm(start), end: hhmm(end), startMinute: start, subject });
    }
  }
  return lessons;
}

/** Já dá para marcar: a aula começa em até 30 min (ou já começou). */
export function isLessonOpen(lesson: Pick<DayLessonInfo, "startMinute">, nowMinute: number): boolean {
  return nowMinute >= lesson.startMinute - MARK_OPENS_BEFORE_MINUTES;
}

/**
 * Números das aulas que um registro de presença cobre. Registros novos
 * guardam exatamente o que o aluno marcou; os antigos (leitura do QR com
 * tolerância de horário) deduzem: as ÚLTIMAS aulas do bloco.
 */
export function lessonNumbersOfScan(row: {
  block: number;
  lessons_credited: number;
  lessons_total: number;
  lesson_numbers: number[] | null;
}): number[] {
  if (row.lesson_numbers && row.lesson_numbers.length > 0) return [...row.lesson_numbers].sort((a, b) => a - b);
  const offset = row.block === 2 ? row.lessons_total : 0;
  return Array.from(
    { length: row.lessons_credited },
    (_, i) => row.lessons_total - row.lessons_credited + 1 + i + offset,
  );
}

/** Usado só para conferir horários vindos do banco ("HH:MM:SS"). */
export function minutesOf(time: string): number {
  return toMinutes(time);
}
