/**
 * Utilidades de data no fuso America/Sao_Paulo, usadas pelas estatísticas
 * e pelo gráfico do dashboard de inscrições. Funções puras — sem
 * Postgres/Supabase, testáveis isoladamente. Evita assumir um offset fixo
 * (o Brasil não observa horário de verão desde 2019, mas o cálculo usa
 * `Intl.DateTimeFormat` em vez de codificar "-03:00" para não quebrar caso
 * isso mude).
 */

const SAO_PAULO_TZ = "America/Sao_Paulo";

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

/** "YYYY-MM-DD" do dia calendário em São Paulo para o instante informado. */
export function getSaoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** Instante UTC que corresponde a 00:00:00 em São Paulo do mesmo dia calendário. */
export function startOfSaoPauloDay(date: Date): Date {
  const key = getSaoPauloDateKey(date);
  const naiveUtc = new Date(`${key}T00:00:00Z`).getTime();
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(naiveUtc), SAO_PAULO_TZ);
  return new Date(naiveUtc - offsetMinutes * 60000);
}

/** Início da semana ISO (segunda-feira 00:00) em São Paulo. */
export function startOfSaoPauloWeek(date: Date): Date {
  const dayStart = startOfSaoPauloDay(date);
  const key = getSaoPauloDateKey(dayStart);
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(dayStart.getTime() - daysSinceMonday * 86_400_000);
}

/** Início do mês calendário (dia 1, 00:00) em São Paulo. */
export function startOfSaoPauloMonth(date: Date): Date {
  const key = getSaoPauloDateKey(date);
  const [year, month] = key.split("-");
  const naiveUtc = new Date(`${year}-${month}-01T00:00:00Z`).getTime();
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(naiveUtc), SAO_PAULO_TZ);
  return new Date(naiveUtc - offsetMinutes * 60000);
}

export function addSaoPauloDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Início do dia (00:00 em São Paulo) para uma chave "YYYY-MM-DD" — inverso de `getSaoPauloDateKey`. */
export function startOfSaoPauloDayFromKey(key: string): Date {
  return startOfSaoPauloDay(new Date(`${key}T12:00:00Z`));
}

/** "dd/MM/AAAA HH:mm" em São Paulo, para exibição na tabela/detalhes. */
export function formatSaoPauloDateTime(iso: string): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  // O ICU insere vírgula entre data e hora ("10/03/2026, 12:05") — removida
  // para o formato mais comum em telas administrativas brasileiras.
  return formatted.replace(",", "");
}

/** Rótulo curto "dd/MM" para pontos de gráfico por dia. */
export function formatSaoPauloDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/** Rótulo curto "MMM/AAAA" para pontos de gráfico por mês. */
export function formatSaoPauloMonthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    month: "short",
    year: "2-digit",
  }).format(date);
  return label.replace(".", "");
}

/**
 * "sábado, 3 de outubro de 2026" a partir de uma chave "YYYY-MM-DD" (data de
 * calendário pura, sem hora) — usado nos cards de encontro/agenda do aluno.
 * `T12:00:00Z` evita que o dia vire a data anterior/seguinte por causa do
 * fuso ao converter para `Date`.
 */
export function formatSaoPauloLongDate(dateKey: string, options?: { capitalize?: boolean }): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00Z`));
  return options?.capitalize ? formatted.charAt(0).toUpperCase() + formatted.slice(1) : formatted;
}

/** "08:00" a partir de "08:00:00" (formato `time` do Postgres). */
function toHoursMinutes(time: string): string {
  return time.slice(0, 5);
}

/** "08:00 – 12:30", ou só um lado quando o outro horário não existe. */
export function formatSaoPauloTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${toHoursMinutes(start)} – ${toHoursMinutes(end)}`;
  if (start) return toHoursMinutes(start);
  if (end) return toHoursMinutes(end);
  return "";
}
