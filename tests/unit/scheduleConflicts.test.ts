import { describe, expect, it } from "vitest";
import { detectScheduleConflicts, type ScheduleBlockInterval } from "@/modules/teaching/scheduleConflicts";

function block(overrides: Partial<ScheduleBlockInterval>): ScheduleBlockInterval {
  return {
    id: "id",
    dateKey: "2026-10-03",
    startTime: "08:00",
    endTime: "09:00",
    label: "Bloco",
    ...overrides,
  };
}

describe("detectScheduleConflicts", () => {
  it("não aponta conflito para blocos sequenciais no mesmo dia", () => {
    const blocks = [
      block({ id: "a", startTime: "08:00", endTime: "10:00", label: "Essência" }),
      block({ id: "b", startTime: "10:30", endTime: "12:30", label: "Caminho" }),
    ];
    expect(detectScheduleConflicts(blocks)).toEqual([]);
  });

  it("detecta sobreposição real de horário", () => {
    const blocks = [
      block({ id: "a", startTime: "08:00", endTime: "10:00", label: "Essência" }),
      block({ id: "b", startTime: "09:30", endTime: "11:00", label: "Caminho" }),
    ];
    const conflicts = detectScheduleConflicts(blocks);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.blocks.map((b) => b.id).sort()).toEqual(["a", "b"]);
  });

  it("não considera datas diferentes como conflito", () => {
    const blocks = [
      block({ id: "a", dateKey: "2026-10-03", startTime: "08:00", endTime: "10:00" }),
      block({ id: "b", dateKey: "2026-10-10", startTime: "08:00", endTime: "10:00" }),
    ];
    expect(detectScheduleConflicts(blocks)).toEqual([]);
  });

  it("trata horários adjacentes (fim = início) como não sobrepostos", () => {
    const blocks = [
      block({ id: "a", startTime: "08:00", endTime: "09:00" }),
      block({ id: "b", startTime: "09:00", endTime: "10:00" }),
    ];
    expect(detectScheduleConflicts(blocks)).toEqual([]);
  });
});
