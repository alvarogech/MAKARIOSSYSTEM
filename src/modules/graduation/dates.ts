/**
 * Datas da cerimônia. O Brasil não tem horário de verão desde 2019, então o
 * fuso de São Paulo é sempre -03:00; o formulário trabalha em horário local.
 */

/** "2026-12-01T23:59" (campo datetime-local, horário de Brasília) → ISO com fuso. */
export function fromLocalInput(value: string): string | null {
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
  const iso = `${text}:00-03:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** ISO → "2026-12-01T23:59" no horário de Brasília, para preencher o campo. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function formatDay(dateKey: string | null): string {
  if (!dateKey) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${dateKey}T12:00:00-03:00`),
  );
}

export function formatShortDay(dateKey: string | null): string {
  if (!dateKey) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(`${dateKey}T12:00:00-03:00`));
}
