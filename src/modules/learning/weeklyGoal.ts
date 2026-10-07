/** Meta semanal opcional. Semana = segunda a domingo no horário de São Paulo (sem horário de verão desde 2019). */

export const GOAL_MIN = 1;
export const GOAL_MAX = 5;

const WEEKDAY_FROM_MONDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export interface WeekBounds {
  /** yyyy-mm-dd da segunda-feira. */
  startKey: string;
  /** Início (inclusive) e fim (exclusivo) em ISO, com fuso de São Paulo. */
  startIso: string;
  endIso: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function weekBounds(now: Date): WeekBounds {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const todayUtc = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  const offset = WEEKDAY_FROM_MONDAY[get("weekday")] ?? 0;
  const monday = new Date(todayUtc.getTime() - offset * 86_400_000);
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  return {
    startKey: keyOf(monday),
    startIso: `${keyOf(monday)}T00:00:00-03:00`,
    endIso: `${keyOf(nextMonday)}T00:00:00-03:00`,
  };
}

export interface WeeklyGoalView {
  enabled: boolean;
  target: number;
  /** Desafios enviados + práticas registradas nesta semana. */
  done: number;
  reached: boolean;
}

export function clampTarget(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(value)));
}

export function buildWeeklyGoal(input: { enabled: boolean; target: number; submittedAts: string[]; practicedAts: string[]; bounds: WeekBounds }): WeeklyGoalView {
  const start = new Date(input.bounds.startIso).getTime();
  const end = new Date(input.bounds.endIso).getTime();
  const inWeek = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  };
  const done = input.submittedAts.filter(inWeek).length + input.practicedAts.filter(inWeek).length;
  const target = clampTarget(input.target);
  return { enabled: input.enabled, target, done, reached: input.enabled && done >= target };
}
