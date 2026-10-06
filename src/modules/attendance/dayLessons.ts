import { LESSON_MINUTES, meetingBlocks, type MeetingTimes } from "./rules";

/** Aula que o aluno enxerga: 1 hora (terça/quinta: 2 aulas; sábado: 4). */
export const HOUR_MINUTES = 60;
/** O banco e os relatórios contam em unidades de 30 min; cada aula de 1 hora = 2 unidades. */
export const UNITS_PER_LESSON = HOUR_MINUTES / LESSON_MINUTES;

export interface DayLessonInfo {
  /** Numeração do encontro: 1 a 2 (terça/quinta) ou 1 a 4 (sábado); o bloco 2 continua a do bloco 1. */
  number: number;
  block: 1 | 2;
  /** "HH:MM" */
  start: string;
  end: string;
  subject: string | null;
  /** Unidades de 30 min que esta aula cobre (como o banco registra): aula 1 = [1, 2], aula 2 = [3, 4]... */
  units: number[];
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
    const count = Math.round((block.end - block.start) / HOUR_MINUTES);
    for (let i = 0; i < count; i++) {
      number += 1;
      const start = block.start + i * HOUR_MINUTES;
      const subject = subjects.find((s) => s.start <= start && start < s.end)?.name ?? null;
      lessons.push({
        number,
        block: block.block,
        start: hhmm(start),
        end: hhmm(start + HOUR_MINUTES),
        subject,
        units: Array.from({ length: UNITS_PER_LESSON }, (_, k) => (number - 1) * UNITS_PER_LESSON + k + 1),
      });
    }
  }
  return lessons;
}

/** Aulas de 1 hora inteiramente cobertas pelas unidades de 30 min registradas. */
export function lessonsFromUnits(lessons: DayLessonInfo[], units: Iterable<number>): number[] {
  const set = new Set(units);
  return lessons.filter((l) => l.units.every((u) => set.has(u))).map((l) => l.number);
}

/**
 * Números (em unidades de 30 min) que um registro de presença cobre. Registros
 * novos guardam exatamente o que o aluno marcou; os antigos (leitura do QR com
 * tolerância de horário) deduzem: as ÚLTIMAS unidades do bloco.
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
