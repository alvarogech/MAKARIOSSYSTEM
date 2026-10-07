import { describe, expect, it } from "vitest";
import { lessonStatuses, toProgressCredits, type CreditRow } from "@/modules/attendance/credits";
import { computeProgress } from "@/modules/attendance/progress";

const row = (over: Partial<CreditRow>): CreditRow => ({
  meeting_id: "m1",
  counts_for_meeting_id: "m1",
  lessons: [1],
  minutes: 60,
  source: "qr",
  ...over,
});

describe("toProgressCredits", () => {
  it("QR e lançamento manual do mesmo encontro não contam a mesma aula duas vezes", () => {
    const credits = toProgressCredits([row({ lessons: [1, 2], minutes: 120 }), row({ lessons: [2, 3], minutes: 120, source: "manual" })]);
    expect(credits).toEqual([{ meetingId: "m1", makeupForMeetingId: null, minutes: 180 }]);
  });

  it("reposição em outra turma vira crédito para o encontro reposto", () => {
    const credits = toProgressCredits([row({ meeting_id: "sab1", counts_for_meeting_id: "tq1", lessons: [1, 2], minutes: 120, source: "reposicao" })]);
    expect(credits).toEqual([{ meetingId: "sab1", makeupForMeetingId: "tq1", minutes: 120 }]);
  });

  it("registro sem lista de aulas usa os minutos gravados", () => {
    expect(toProgressCredits([row({ lessons: null, minutes: 90 })])).toEqual([{ meetingId: "m1", makeupForMeetingId: null, minutes: 90 }]);
  });
});

describe("regras de 75% com aulas de 1 hora", () => {
  // Sábado: 4 encontros de 4 h; admite 1 falta (limite de 4 h perdidas).
  const sat = ["a", "b", "c", "d"].map((id) => ({ id, minutes: 240, past: true }));

  it("sem faltas: em dia", () => {
    const credits = sat.map((m) => ({ meetingId: m.id, makeupForMeetingId: null, minutes: 240 }));
    expect(computeProgress(sat, credits).situation).toBe("em_dia");
  });

  it("uma falta no sábado: no limite — pode perder 0 h", () => {
    const credits = ["a", "b", "c"].map((id) => ({ meetingId: id, makeupForMeetingId: null, minutes: 240 }));
    const progress = computeProgress(sat, credits);
    expect(progress.situation).toBe("no_limite");
    expect(progress.slackMinutes).toBe(0);
  });

  it("duas faltas no sábado: reprovado; a reposição de um encontro devolve o limite", () => {
    const credits = ["a", "b"].map((id) => ({ meetingId: id, makeupForMeetingId: null, minutes: 240 }));
    expect(computeProgress(sat, credits).situation).toBe("reprovado");
    const withMakeup = [...credits, { meetingId: "tq-x", makeupForMeetingId: "c", minutes: 240 }];
    expect(computeProgress(sat, withMakeup).situation).toBe("no_limite");
  });

  // Terça/quinta: 8 encontros de 2 h; admite 2 faltas.
  const tq = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, minutes: 120, past: true }));
  it("terça/quinta: 2 faltas no limite, 3 reprova", () => {
    const attended = (n: number) => tq.slice(0, n).map((m) => ({ meetingId: m.id, makeupForMeetingId: null, minutes: 120 }));
    expect(computeProgress(tq, attended(6)).situation).toBe("no_limite");
    expect(computeProgress(tq, attended(5)).situation).toBe("reprovado");
  });
});

describe("lessonStatuses", () => {
  const lessons = [
    { number: 1, startMinute: 8 * 60 },
    { number: 2, startMinute: 9 * 60 },
    { number: 3, startMinute: 10 * 60 + 30 },
    { number: 4, startMinute: 11 * 60 + 30 },
  ];
  const base = { lessons, makeupMinutes: 0, meetingDate: "2026-10-03", today: "2026-10-10", nowMinute: 0 };

  it("encontro futuro: tudo futuro", () => {
    const s = lessonStatuses({ ...base, present: [], meetingDate: "2026-10-17" });
    expect([...s.values()]).toEqual(["futuro", "futuro", "futuro", "futuro"]);
  });

  it("chegou depois: aulas antes da primeira presença são atraso; depois, ausente", () => {
    const s = lessonStatuses({ ...base, present: [2, 3] });
    expect([...s.values()]).toEqual(["atraso", "presente", "presente", "ausente"]);
  });

  it("reposição preenche as aulas perdidas", () => {
    const s = lessonStatuses({ ...base, present: [], makeupMinutes: 120 });
    expect([...s.values()]).toEqual(["reposicao", "reposicao", "ausente", "ausente"]);
  });

  it("no dia do encontro, aulas que ainda não começaram são futuras", () => {
    const s = lessonStatuses({ ...base, present: [1], meetingDate: "2026-10-10", today: "2026-10-10", nowMinute: 8 * 60 + 30 });
    expect([...s.values()]).toEqual(["presente", "futuro", "futuro", "futuro"]);
  });
});
