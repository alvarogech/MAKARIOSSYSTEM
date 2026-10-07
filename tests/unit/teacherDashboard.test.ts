import { describe, expect, it } from "vitest";
import { countdownLabel, daysBetween, weekStrip } from "@/modules/teaching/teacherDashboardLogic";

describe("countdownLabel", () => {
  it("hoje, amanhã e em N dias", () => {
    expect(countdownLabel("2026-10-07", "19:30:00", "2026-10-07")).toBe("hoje · 19:30");
    expect(countdownLabel("2026-10-08", "19:30:00", "2026-10-07")).toBe("amanhã · 19:30");
    expect(countdownLabel("2026-10-10", "08:00:00", "2026-10-07")).toBe("em 3 dias");
  });
  it("sem horário e passado", () => {
    expect(countdownLabel("2026-10-07", null, "2026-10-07")).toBe("hoje");
    expect(countdownLabel("2026-10-06", "19:30:00", "2026-10-07")).toBe("já passou");
  });
  it("atravessa virada de mês", () => {
    expect(daysBetween("2026-10-30", "2026-11-03")).toBe(4);
    expect(countdownLabel("2026-11-01", null, "2026-10-31")).toBe("amanhã");
  });
});

describe("weekStrip", () => {
  const lessons = [
    { dateKey: "2026-10-08" as string | null, label: "A" },
    { dateKey: "2026-10-08" as string | null, label: "B" },
    { dateKey: "2026-10-14" as string | null, label: "fora da semana" },
    { dateKey: null, label: "sem data" },
  ];

  it("tem 7 dias começando hoje, com as aulas marcadas no dia certo", () => {
    const week = weekStrip("2026-10-07", lessons);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ dateKey: "2026-10-07", weekday: "qua", dayNumber: 7, isToday: true });
    expect(week[1]!.items.map((i) => i.label)).toEqual(["A", "B"]);
    expect(week.flatMap((d) => d.items).map((i) => i.label)).not.toContain("fora da semana");
    expect(week.flatMap((d) => d.items).map((i) => i.label)).not.toContain("sem data");
  });

  it("vira o mês sem quebrar", () => {
    const week = weekStrip("2026-10-29", []);
    expect(week.map((d) => d.dateKey)).toEqual([
      "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
    ]);
  });
});
