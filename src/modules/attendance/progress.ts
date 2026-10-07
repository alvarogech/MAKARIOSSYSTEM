/**
 * Cálculo puro da frequência pela chamada por QR (sem banco, testável).
 *
 * Regra (doc 02 §9): 16 h presenciais por volume, mínimo de 75% (12 h).
 * Na prática: sábado (4 encontros de 4 h) admite 1 falta; terça/quinta
 * (8 encontros de 2 h) admite 2. Atraso conta proporcionalmente (aulas de
 * 1 hora), e a reposição em outra turma devolve os minutos do encontro.
 */

export const MIN_ATTENDANCE_RATIO = 0.75;

export interface MeetingInfo {
  id: string;
  minutes: number;
  /** Já aconteceu (ou terminou hoje): só esses entram nas faltas. */
  past: boolean;
}

export interface ScanCredit {
  meetingId: string;
  makeupForMeetingId: string | null;
  minutes: number;
}

export type Situation = "em_dia" | "atencao" | "no_limite" | "reprovado";

export interface Progress {
  attendedMinutes: number;
  missedMinutes: number;
  totalMinutes: number;
  /** Encontros já realizados sem nenhum minuto reconhecido. */
  absences: number;
  situation: Situation;
  /** Minutos que ainda pode perder sem reprovar (0 se no limite ou reprovado). */
  slackMinutes: number;
}

/** Minutos reconhecidos em cada encontro da turma do aluno (presença + reposição). */
export function creditsByMeeting(meetings: MeetingInfo[], scans: ScanCredit[]): Map<string, number> {
  const credit = new Map<string, number>();
  for (const scan of scans) {
    const target = scan.makeupForMeetingId ?? scan.meetingId;
    credit.set(target, (credit.get(target) ?? 0) + scan.minutes);
  }
  const capped = new Map<string, number>();
  for (const m of meetings) capped.set(m.id, Math.min(m.minutes, credit.get(m.id) ?? 0));
  return capped;
}

export function computeProgress(meetings: MeetingInfo[], scans: ScanCredit[]): Progress {
  const credit = creditsByMeeting(meetings, scans);
  const totalMinutes = meetings.reduce((sum, m) => sum + m.minutes, 0);
  let attended = 0;
  let missed = 0;
  let absences = 0;
  for (const m of meetings) {
    const c = credit.get(m.id) ?? 0;
    attended += c;
    if (m.past) {
      missed += m.minutes - c;
      if (c === 0) absences++;
    }
  }
  const allowedMiss = Math.floor(totalMinutes * (1 - MIN_ATTENDANCE_RATIO));
  const situation: Situation =
    missed > allowedMiss ? "reprovado" : missed === allowedMiss && missed > 0 ? "no_limite" : missed > 0 ? "atencao" : "em_dia";
  return {
    attendedMinutes: attended,
    missedMinutes: missed,
    totalMinutes,
    absences,
    situation,
    slackMinutes: Math.max(0, allowedMiss - missed),
  };
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
