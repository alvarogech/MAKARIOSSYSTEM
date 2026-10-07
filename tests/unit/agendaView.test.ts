import { describe, expect, it } from "vitest";
import { buildAgendaStates, type AgendaLessonInput } from "@/modules/teaching/agendaView";
import { buildIcsFeed } from "@/lib/ics";

const lesson = (id: string, date: string, start: string, end: string, over: Partial<AgendaLessonInput> = {}): AgendaLessonInput => ({
  blockId: id,
  meetingId: "m" + id,
  classId: "c1",
  dateKey: date,
  startTime: start,
  endTime: end,
  blockStatus: "scheduled",
  meetingStatus: "scheduled",
  ...over,
});

// Quarta 07/10/2026 às 15:00 (SP) = 18:00Z.
const ctx = (extra: object = {}) => ({
  todayKey: "2026-10-07",
  now: new Date("2026-10-07T18:00:00Z"),
  reportActiveByClass: new Map<string, boolean>(),
  reportedMeetingIds: new Set<string>(),
  ...extra,
});

describe("buildAgendaStates", () => {
  const list = [
    lesson("past", "2026-10-06", "19:30:00", "21:50:00"),
    lesson("today", "2026-10-07", "19:30:00", "21:50:00"),
    lesson("later", "2026-10-13", "19:30:00", "21:50:00"),
  ];

  it("fases e 'Próxima': a primeira que ainda não terminou", () => {
    const s = buildAgendaStates(list, ctx());
    expect(s.get("past")).toMatchObject({ phase: "over", isNext: false });
    expect(s.get("today")).toMatchObject({ phase: "today", isNext: true });
    expect(s.get("later")).toMatchObject({ phase: "future", isNext: false });
  });

  it("antes e no dia: Preparar; depois: Ver resumo quando o relatório não é exigido", () => {
    const s = buildAgendaStates(list, ctx());
    expect(s.get("today")?.action?.label).toBe("Preparar");
    expect(s.get("past")?.action?.label).toBe("Ver resumo");
  });

  it("depois da aula, com relatório exigido e não enviado: Relatório; enviado: Ver resumo", () => {
    const active = new Map([["c1", true]]);
    expect(buildAgendaStates(list, ctx({ reportActiveByClass: active })).get("past")?.action?.label).toBe("Relatório");
    expect(buildAgendaStates(list, ctx({ reportActiveByClass: active, reportedMeetingIds: new Set(["mpast"]) })).get("past")?.action?.label).toBe("Ver resumo");
  });

  it("a aula de hoje que já terminou vira 'depois' e a próxima passa para a seguinte", () => {
    const s = buildAgendaStates(list, ctx({ now: new Date("2026-10-08T01:00:00Z") })); // 22:00 em SP
    expect(s.get("today")).toMatchObject({ phase: "over", isNext: false });
    expect(s.get("later")?.isNext).toBe(true);
  });

  it("cancelada não tem ação nem é a próxima", () => {
    const s = buildAgendaStates([lesson("x", "2026-10-08", "19:30:00", "21:50:00", { blockStatus: "canceled" }), ...list], ctx());
    expect(s.get("x")).toMatchObject({ canceled: true, isNext: false, action: null });
  });
});

describe("buildIcsFeed", () => {
  it("vários eventos, UID estável e dicas de atualização", () => {
    const ics = buildIcsFeed(
      [
        { uid: "a@x", title: "Aula A", startUtc: new Date("2026-10-08T22:30:00Z"), endUtc: new Date("2026-10-09T00:50:00Z"), location: "UNEED, Goiânia" },
        { uid: "b@x", title: "Aula B", startUtc: new Date("2026-10-13T22:30:00Z"), endUtc: new Date("2026-10-14T00:50:00Z") },
      ],
      "Aulas Makários",
    );
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:a@x");
    expect(ics).toContain("X-WR-CALNAME:Aulas Makários");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(ics).toContain("LOCATION:UNEED\\, Goiânia");
    expect(ics).toContain("\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
});
