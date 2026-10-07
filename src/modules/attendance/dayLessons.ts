import { LESSON_MINUTES, meetingBlocks, type MeetingTimes } from "./rules";

export interface DayLessonInfo {
  /** Numeração do encontro: 1 a 2 (terça/quinta) ou 1 a 4 (sábado); o bloco 2 continua a do bloco 1. */
  number: number;
  block: 1 | 2;
  /** "HH:MM" */
  start: string;
  end: string;
  subject: string | null;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * As aulas de 1 hora de um encontro, na ordem, cada uma com seu horário e a
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
      const subject = subjects.find((s) => s.start <= start && start < s.end)?.name ?? null;
      lessons.push({ number, block: block.block, start: hhmm(start), end: hhmm(start + LESSON_MINUTES), subject });
    }
  }
  return lessons;
}

/** Números das aulas (de 1 hora) que um registro de presença cobre. */
export function lessonNumbersOfScan(row: {
  block: number;
  lessons_credited: number;
  lessons_total: number;
  lesson_numbers: number[] | null;
}): number[] {
  if (row.lesson_numbers) return [...row.lesson_numbers].sort((a, b) => a - b);
  // Registros sem a lista exata (não deveriam existir depois da migração): as últimas aulas do bloco.
  const offset = row.block === 2 ? row.lessons_total : 0;
  return Array.from(
    { length: row.lessons_credited },
    (_, i) => row.lessons_total - row.lessons_credited + 1 + i + offset,
  );
}
