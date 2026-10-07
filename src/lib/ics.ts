/**
 * Geração de eventos de calendário (arquivo .ics e link do Google Calendar)
 * a partir de um único evento com início/término em UTC já resolvidos —
 * puro, sem Supabase, testável isoladamente. Nunca inclui links privados de
 * material/gabarito na descrição.
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startUtc: Date;
  endUtc: Date;
}

function formatIcsDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Corpo de um arquivo .ics de um único evento (BEGIN:VCALENDAR...END:VCALENDAR). */
export function buildIcsCalendar(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plataforma Makarios//Agenda do Professor//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.startUtc)}`,
    `DTEND:${formatIcsDate(event.endUtc)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function veventLines(event: CalendarEvent): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.startUtc)}`,
    `DTEND:${formatIcsDate(event.endUtc)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Feed de calendário (vários eventos) para ASSINATURA: o calendário pessoal busca o endereço de tempos em
 * tempos e se atualiza sozinho. Os UIDs são estáveis (id da aula), então remarcar uma aula atualiza o mesmo
 * evento em vez de duplicar.
 */
export function buildIcsFeed(events: CalendarEvent[], calendarName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plataforma Makarios//Agenda do Professor//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const event of events) lines.push(...veventLines(event));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function toGoogleDateParam(date: Date): string {
  return formatIcsDate(date);
}

/** Link "adicionar ao Google Calendar" — abre o formulário já preenchido, sem sincronização automática. */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toGoogleDateParam(event.startUtc)}/${toGoogleDateParam(event.endUtc)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
