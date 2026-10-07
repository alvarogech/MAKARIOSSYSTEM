/** Lógica pura do Início do professor: contagem regressiva e faixa da semana. Sem acesso a banco. */

const DAY_MS = 86_400_000;

const keyToUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
};
const utcToKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / DAY_MS);
}

/** "hoje · 19:30", "amanhã · 19:30", "em 3 dias" (sem horário quando não houver). */
export function countdownLabel(dateKey: string, startTime: string | null, todayKey: string): string {
  const days = daysBetween(todayKey, dateKey);
  const time = startTime ? startTime.slice(0, 5) : null;
  if (days < 0) return "já passou";
  if (days === 0) return time ? `hoje · ${time}` : "hoje";
  if (days === 1) return time ? `amanhã · ${time}` : "amanhã";
  return `em ${days} dias`;
}

export interface WeekItem<T> {
  dateKey: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  items: T[];
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Os 7 dias a partir de hoje, com os itens (aulas) de cada um. */
export function weekStrip<T extends { dateKey: string | null }>(todayKey: string, items: T[]): WeekItem<T>[] {
  const start = keyToUtc(todayKey);
  return Array.from({ length: 7 }, (_, i) => {
    const ms = start + i * DAY_MS;
    const key = utcToKey(ms);
    const date = new Date(ms);
    return {
      dateKey: key,
      weekday: WEEKDAYS[date.getUTCDay()]!,
      dayNumber: date.getUTCDate(),
      isToday: i === 0,
      items: items.filter((item) => item.dateKey === key),
    };
  });
}
