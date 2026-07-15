import { describe, expect, it } from "vitest";
import {
  generateClassMeetings,
  isTemplateMinutesConsistent,
} from "@/services/classMeetings";

// Valores exatos do doc 08 §4/§5.
const TERCA_QUINTA = {
  meetingsCount: 8,
  academicMinutesPerMeeting: 120,
  startTime: "19:30",
  endTime: "21:50",
  breakMinutes: 20,
};

const SABADO = {
  meetingsCount: 4,
  academicMinutesPerMeeting: 240,
  startTime: "08:00",
  endTime: "12:30",
  breakMinutes: 30,
};

describe("generateClassMeetings", () => {
  it("gera 8 encontros de 120 minutos para o modelo terça/quinta (960 min = 16h)", () => {
    const meetings = generateClassMeetings(TERCA_QUINTA);
    expect(meetings).toHaveLength(8);
    expect(meetings.reduce((sum, m) => sum + m.academicMinutes, 0)).toBe(960);
    expect(meetings[0]).toEqual({
      sequence: 1,
      academicMinutes: 120,
      startTime: "19:30",
      endTime: "21:50",
      breakMinutes: 20,
    });
    expect(meetings[7]?.sequence).toBe(8);
  });

  it("gera 4 encontros de 240 minutos para o modelo sábado (960 min = 16h)", () => {
    const meetings = generateClassMeetings(SABADO);
    expect(meetings).toHaveLength(4);
    expect(meetings.reduce((sum, m) => sum + m.academicMinutes, 0)).toBe(960);
  });

  it("nunca inclui uma data de encontro (não inventar datas — doc 08 §14)", () => {
    const meetings = generateClassMeetings(TERCA_QUINTA);
    for (const meeting of meetings) {
      expect(meeting).not.toHaveProperty("meetingDate");
    }
  });
});

describe("isTemplateMinutesConsistent", () => {
  it("aceita o modelo terça/quinta (8 × 120 = 960)", () => {
    expect(
      isTemplateMinutesConsistent({ ...TERCA_QUINTA, totalAcademicMinutes: 960 }),
    ).toBe(true);
  });

  it("aceita o modelo sábado (4 × 240 = 960)", () => {
    expect(
      isTemplateMinutesConsistent({ ...SABADO, totalAcademicMinutes: 960 }),
    ).toBe(true);
  });

  it("rejeita um total inconsistente", () => {
    expect(
      isTemplateMinutesConsistent({ ...TERCA_QUINTA, totalAcademicMinutes: 999 }),
    ).toBe(false);
  });
});
