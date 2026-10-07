/**
 * Regras puras da chamada por QR Code (sem banco, testáveis isoladamente).
 *
 * Cada encontro tem dois blocos separados pelo intervalo, e cada bloco é feito
 * de aulas de 1 hora: terça/quinta tem 2 aulas por encontro (1 + 1) e sábado
 * tem 4 (2 + 2). O aluno lê o QR uma vez no dia e marca em quais aulas esteve.
 */

export const LESSON_MINUTES = 60;

export interface MeetingTimes {
  /** "HH:MM" ou "HH:MM:SS" */
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function meetingBlocks(meeting: MeetingTimes) {
  const start = toMinutes(meeting.startTime);
  const end = toMinutes(meeting.endTime);
  const half = (end - start - meeting.breakMinutes) / 2;
  const block1End = start + half;
  const block2Start = block1End + meeting.breakMinutes;
  return [
    { block: 1 as const, start, end: block1End, lessons: Math.round(half / LESSON_MINUTES) },
    { block: 2 as const, start: block2Start, end, lessons: Math.round(half / LESSON_MINUTES) },
  ] as const;
}

export type ScheduleSlug = "terca_quinta" | "sabado";

/**
 * Reposição entre turmas do mesmo volume: meia manhã de sábado (um bloco)
 * equivale a um encontro inteiro de terça/quinta (doc 02 §11.8).
 * Devolve o número (sequence) do encontro da turma do aluno que o
 * conteúdo assistido cobre, ou `null` se os modelos não se correspondem.
 */
export function makeupTargetSequence(
  attended: { schedule: ScheduleSlug; sequence: number; block: 1 | 2 },
  ownSchedule: ScheduleSlug,
): number | null {
  if (attended.schedule === ownSchedule) return null;
  if (attended.schedule === "sabado" && ownSchedule === "terca_quinta") {
    return (attended.sequence - 1) * 2 + attended.block;
  }
  if (attended.schedule === "terca_quinta" && ownSchedule === "sabado") {
    return Math.ceil(attended.sequence / 2);
  }
  return null;
}

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export type LocationVerdict = "dentro" | "impreciso" | "longe";

/**
 * Dentro do raio de algum local: vale. Fora, mas com o círculo de
 * imprecisão do GPS alcançando o local (sinal ruim dentro do prédio):
 * vale, marcado como impreciso para a coordenação conferir. Fora e com
 * GPS confiável: não vale.
 */
export function locationVerdict(
  device: { lat: number; lng: number; accuracy: number },
  places: { lat: number; lng: number; radius: number }[],
): LocationVerdict {
  let verdict: LocationVerdict = "longe";
  for (const place of places) {
    const d = distanceMeters(device, place);
    if (d <= place.radius) return "dentro";
    if (d - device.accuracy <= place.radius) verdict = "impreciso";
  }
  return verdict;
}

/** Segunda-feira (YYYY-MM-DD) da semana de uma data YYYY-MM-DD. */
export function weekStartOf(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (isoDow - 1));
  return d.toISOString().slice(0, 10);
}
