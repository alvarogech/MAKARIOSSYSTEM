import { describe, expect, it } from "vitest";
import { buildGoogleCalendarUrl, buildIcsCalendar } from "@/lib/ics";

describe("ics", () => {
  const event = {
    uid: "abc-123@makarios",
    title: "Makários · Essência · Criação e Queda",
    description: "Turma Essência — Turma (sábado)",
    location: "Sede Igreja Emaús",
    startUtc: new Date("2026-10-03T11:00:00Z"),
    endUtc: new Date("2026-10-03T12:00:00Z"),
  };

  it("gera um VCALENDAR válido com os campos essenciais", () => {
    const ics = buildIcsCalendar(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc-123@makarios");
    expect(ics).toContain("DTSTART:20261003T110000Z");
    expect(ics).toContain("DTEND:20261003T120000Z");
    expect(ics).toContain("SUMMARY:Makários · Essência · Criação e Queda");
    expect(ics).toContain("LOCATION:Sede Igreja Emaús");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("escapa vírgulas e ponto-e-vírgula no texto", () => {
    const ics = buildIcsCalendar({ ...event, title: "Aula; tema, especial" });
    expect(ics).toContain("SUMMARY:Aula\\; tema\\, especial");
  });

  it("monta a URL do Google Calendar com as datas em UTC", () => {
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain("https://calendar.google.com/calendar/render?");
    expect(url).toContain("dates=20261003T110000Z%2F20261003T120000Z");
    expect(url).toContain("text=Mak%C3%A1rios");
  });
});
