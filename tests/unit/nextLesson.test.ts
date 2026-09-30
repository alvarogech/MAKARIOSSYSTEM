import { describe, expect, it } from "vitest";
import { selectNextLesson } from "@/modules/teaching/nextLesson";

const base = { blockStatus: "scheduled", meetingStatus: "scheduled" };

describe("selectNextLesson", () => {
  it("escolhe a aula futura mais próxima", () => {
    const blocks = [
      { ...base, meetingDateKey: "2026-10-17", startTime: "08:00" },
      { ...base, meetingDateKey: "2026-10-03", startTime: "08:00" },
    ];
    expect(selectNextLesson(blocks, "2026-10-01")?.meetingDateKey).toBe("2026-10-03");
  });

  it("ignora bloco cancelado mesmo sendo o mais próximo", () => {
    const blocks = [
      { ...base, meetingDateKey: "2026-10-03", startTime: "08:00", blockStatus: "canceled" },
      { ...base, meetingDateKey: "2026-10-10", startTime: "08:00" },
    ];
    expect(selectNextLesson(blocks, "2026-10-01")?.meetingDateKey).toBe("2026-10-10");
  });

  it("ignora aula cujo encontro inteiro foi cancelado", () => {
    const blocks = [
      { ...base, meetingDateKey: "2026-10-03", startTime: "08:00", meetingStatus: "canceled" },
      { ...base, meetingDateKey: "2026-10-10", startTime: "08:00" },
    ];
    expect(selectNextLesson(blocks, "2026-10-01")?.meetingDateKey).toBe("2026-10-10");
  });

  it("ignora blocos sem data ainda definida", () => {
    const blocks = [{ ...base, meetingDateKey: null, startTime: "08:00" }];
    expect(selectNextLesson(blocks, "2026-10-01")).toBeNull();
  });

  it("desempata por horário de início no mesmo dia", () => {
    const blocks = [
      { ...base, meetingDateKey: "2026-10-03", startTime: "10:30" },
      { ...base, meetingDateKey: "2026-10-03", startTime: "08:00" },
    ];
    expect(selectNextLesson(blocks, "2026-10-03")?.startTime).toBe("08:00");
  });
});
