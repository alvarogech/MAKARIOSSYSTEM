import { LESSON_MINUTES } from "./rules";
import type { ScanCredit } from "./progress";

/** Linha devolvida por public.attendance_credits(). */
export interface CreditRow {
  meeting_id: string;
  counts_for_meeting_id: string;
  lessons: number[] | null;
  minutes: number;
  source: string;
}

/**
 * Transforma as presenças de UMA pessoa em créditos para o cálculo de frequência.
 * Na turma da própria pessoa, QR e lançamento manual do mesmo encontro se somam SEM contar a
 * mesma aula duas vezes (união das aulas); reposição em outra turma entra em minutos e
 * devolve as horas do encontro que ela repõe.
 */
export function toProgressCredits(rows: CreditRow[]): ScanCredit[] {
  const own = new Map<string, Set<number>>();
  const ownLegacyMinutes = new Map<string, number>();
  const credits: ScanCredit[] = [];

  for (const row of rows) {
    if (row.counts_for_meeting_id !== row.meeting_id) {
      credits.push({ meetingId: row.meeting_id, makeupForMeetingId: row.counts_for_meeting_id, minutes: row.minutes });
      continue;
    }
    if (row.lessons && row.lessons.length > 0) {
      own.set(row.meeting_id, new Set([...(own.get(row.meeting_id) ?? []), ...row.lessons]));
    } else if (row.minutes > 0) {
      ownLegacyMinutes.set(row.meeting_id, Math.max(ownLegacyMinutes.get(row.meeting_id) ?? 0, row.minutes));
    }
  }

  for (const [meetingId, set] of own) {
    credits.push({ meetingId, makeupForMeetingId: null, minutes: set.size * LESSON_MINUTES });
  }
  for (const [meetingId, minutes] of ownLegacyMinutes) {
    if (!own.has(meetingId)) credits.push({ meetingId, makeupForMeetingId: null, minutes });
  }
  return credits;
}

export type LessonStatus = "presente" | "autodeclarada" | "ausente" | "atraso" | "reposicao" | "futuro";

/**
 * Situação de cada aula (de 1 hora) de um encontro para o aluno:
 * - futuro: o encontro (ou a aula) ainda não aconteceu;
 * - presente: a aula consta nas presenças da própria turma (QR ou lançamento manual);
 * - autodeclarada: só consta porque o próprio aluno declarou (a coordenação ainda pode revogar);
 * - atraso: faltou a aula, mas esteve em alguma aula DEPOIS dela (chegou depois do início);
 * - reposição: as horas foram devolvidas por reposição em outra turma;
 * - ausente: nenhuma das anteriores.
 */
export function lessonStatuses(input: {
  lessons: { number: number; startMinute: number }[];
  present: number[];
  /** Aulas que só constam por autodeclaração. */
  declared?: number[];
  makeupMinutes: number;
  meetingDate: string;
  today: string;
  nowMinute: number;
}): Map<number, LessonStatus> {
  const declared = new Set(input.declared ?? []);
  const present = new Set(input.present);
  const anyCredited = [...input.present, ...declared];
  const firstPresent = anyCredited.length > 0 ? Math.min(...anyCredited) : null;
  let makeupLeft = input.makeupMinutes;
  const result = new Map<number, LessonStatus>();

  for (const lesson of input.lessons) {
    const notStarted =
      input.meetingDate > input.today || (input.meetingDate === input.today && lesson.startMinute > input.nowMinute);
    if (present.has(lesson.number)) {
      result.set(lesson.number, "presente");
    } else if (declared.has(lesson.number)) {
      result.set(lesson.number, "autodeclarada");
    } else if (notStarted) {
      result.set(lesson.number, "futuro");
    } else if (makeupLeft >= LESSON_MINUTES) {
      makeupLeft -= LESSON_MINUTES;
      result.set(lesson.number, "reposicao");
    } else if (firstPresent !== null && lesson.number < firstPresent) {
      result.set(lesson.number, "atraso");
    } else {
      result.set(lesson.number, "ausente");
    }
  }
  return result;
}
