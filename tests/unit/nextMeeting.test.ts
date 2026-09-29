import { describe, expect, it } from "vitest";
import { selectNextMeeting } from "@/modules/learning/nextMeeting";

describe("selectNextMeeting", () => {
  it("escolhe o encontro futuro mais próximo", () => {
    const meetings = [
      { id: "a", meetingDateKey: "2026-10-17", startTime: "08:00:00" },
      { id: "b", meetingDateKey: "2026-10-03", startTime: "08:00:00" },
      { id: "c", meetingDateKey: "2026-10-10", startTime: "08:00:00" },
    ];
    expect(selectNextMeeting(meetings, "2026-10-01")?.id).toBe("b");
  });

  it("inclui o encontro de hoje, mas ignora encontros passados", () => {
    const meetings = [
      { id: "past", meetingDateKey: "2026-10-01", startTime: "08:00:00" },
      { id: "today", meetingDateKey: "2026-10-10", startTime: "08:00:00" },
    ];
    expect(selectNextMeeting(meetings, "2026-10-10")?.id).toBe("today");
  });

  it("desempata por horário de início no mesmo dia", () => {
    const meetings = [
      { id: "tarde", meetingDateKey: "2026-10-10", startTime: "10:30:00" },
      { id: "manha", meetingDateKey: "2026-10-10", startTime: "08:00:00" },
    ];
    expect(selectNextMeeting(meetings, "2026-10-10")?.id).toBe("manha");
  });

  it("retorna null quando não há nenhum encontro futuro", () => {
    const meetings = [{ id: "a", meetingDateKey: "2026-01-01", startTime: null }];
    expect(selectNextMeeting(meetings, "2026-10-10")).toBeNull();
  });

  it("retorna null para lista vazia", () => {
    expect(selectNextMeeting([], "2026-10-10")).toBeNull();
  });
});
