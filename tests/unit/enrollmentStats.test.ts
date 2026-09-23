import { describe, expect, it } from "vitest";
import { buildChartPoints, computeEnrollmentStats, getPeriodStart } from "@/modules/enrollment/queries";
import type { EnrollmentStatsRow } from "@/modules/enrollment/types";

const NOW = new Date("2026-03-12T15:00:00Z"); // quinta-feira, 12h em São Paulo

function row(overrides: Partial<EnrollmentStatsRow>): EnrollmentStatsRow {
  return {
    status: "pending",
    primaryVolumeSlug: "essencia",
    primaryScheduleSlug: "terca_quinta",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("computeEnrollmentStats", () => {
  it("conta total, hoje, semana e mês corretamente", () => {
    const rows: EnrollmentStatsRow[] = [
      row({ createdAt: "2026-03-12T14:00:00Z" }), // hoje
      row({ createdAt: "2026-03-09T14:00:00Z" }), // segunda desta semana
      row({ createdAt: "2026-03-01T14:00:00Z" }), // este mês, semana passada
      row({ createdAt: "2026-01-15T14:00:00Z" }), // fora do mês/semana
      row({ createdAt: "2026-03-12T14:00:00Z", status: "approved", primaryVolumeSlug: "caminho" }),
    ];

    const stats = computeEnrollmentStats(rows, NOW);

    expect(stats.total).toBe(5);
    expect(stats.today).toBe(2);
    expect(stats.thisWeek).toBe(3);
    expect(stats.thisMonth).toBe(4);
    expect(stats.byStatus.find((s) => s.status === "approved")?.count).toBe(1);
    expect(stats.byStatus.find((s) => s.status === "pending")?.count).toBe(4);
    expect(stats.byVolume.find((v) => v.slug === "caminho")?.count).toBe(1);
    expect(stats.byVolume.find((v) => v.slug === "essencia")?.count).toBe(4);
  });

  it("conta por turma (meio de semana / fim de semana)", () => {
    const rows: EnrollmentStatsRow[] = [
      row({ primaryScheduleSlug: "terca_quinta" }),
      row({ primaryScheduleSlug: "terca_quinta" }),
      row({ primaryScheduleSlug: "sabado" }),
    ];
    const stats = computeEnrollmentStats(rows, NOW);
    expect(stats.bySchedule.find((s) => s.slug === "terca_quinta")?.count).toBe(2);
    expect(stats.bySchedule.find((s) => s.slug === "sabado")?.count).toBe(1);
  });

  it("nunca inventa volumes/turmas/status fora do catálogo real", () => {
    const stats = computeEnrollmentStats([], NOW);
    expect(stats.byVolume.map((v) => v.slug)).toEqual(["essencia", "caminho", "voz"]);
    expect(stats.bySchedule.map((s) => s.slug)).toEqual(["terca_quinta", "sabado"]);
    expect(stats.byStatus.map((s) => s.status)).toEqual([
      "pending",
      "approved",
      "rejected",
      "cancelled",
    ]);
  });
});

describe("buildChartPoints", () => {
  it("gera 14 pontos diários somando corretamente por dia", () => {
    const rows: EnrollmentStatsRow[] = [
      row({ createdAt: "2026-03-12T14:00:00Z" }),
      row({ createdAt: "2026-03-12T20:00:00Z" }),
      row({ createdAt: "2026-03-11T14:00:00Z" }),
    ];
    const points = buildChartPoints(rows, "day", NOW);
    expect(points).toHaveLength(14);
    expect(points.at(-1)?.count).toBe(2); // hoje
    expect(points.at(-2)?.count).toBe(1); // ontem
    expect(points.at(0)?.count).toBe(0);
  });
});

describe("getPeriodStart", () => {
  it("retorna null para 'all'", () => {
    expect(getPeriodStart("all", NOW)).toBeNull();
  });

  it("retorna o início do dia para 'today'", () => {
    expect(getPeriodStart("today", NOW)?.toISOString()).toBe("2026-03-12T03:00:00.000Z");
  });
});
