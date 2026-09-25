import { describe, expect, it } from "vitest";
import { buildChartPoints, computeEnrollmentStats, getPeriodStart } from "@/modules/enrollment/queries";
import type { EnrollmentStatsRow } from "@/modules/enrollment/types";

const NOW = new Date("2026-03-12T15:00:00Z"); // quinta-feira, 12h em São Paulo

function row(overrides: Partial<EnrollmentStatsRow>): EnrollmentStatsRow {
  return {
    status: "pending",
    primaryVolumeSlug: "essencia",
    primaryScheduleSlug: "terca_quinta",
    isOtherChurchMember: null,
    isEmausMember: null,
    hasGr: null,
    grNetworkSlug: null,
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

  it("conta por curso e turma combinados (ex.: Essência · Sábados)", () => {
    const rows: EnrollmentStatsRow[] = [
      row({ primaryVolumeSlug: "essencia", primaryScheduleSlug: "terca_quinta" }),
      row({ primaryVolumeSlug: "essencia", primaryScheduleSlug: "terca_quinta" }),
      row({ primaryVolumeSlug: "essencia", primaryScheduleSlug: "sabado" }),
      row({ primaryVolumeSlug: "caminho", primaryScheduleSlug: "sabado" }),
    ];
    const stats = computeEnrollmentStats(rows, NOW);
    const find = (volumeSlug: string, scheduleSlug: string) =>
      stats.byVolumeSchedule.find(
        (entry) => entry.volumeSlug === volumeSlug && entry.scheduleSlug === scheduleSlug,
      );

    expect(find("essencia", "terca_quinta")?.count).toBe(2);
    expect(find("essencia", "sabado")?.count).toBe(1);
    expect(find("caminho", "sabado")?.count).toBe(1);
    expect(find("caminho", "terca_quinta")?.count).toBe(0);
    expect(find("essencia", "terca_quinta")?.label).toBe("Essência · Terças e quintas");
  });

  it("nunca inventa volumes/turmas/status fora do catálogo real", () => {
    const stats = computeEnrollmentStats([], NOW);
    expect(stats.byVolume.map((v) => v.slug)).toEqual(["essencia", "caminho", "voz"]);
    expect(stats.byVolumeSchedule.map((entry) => `${entry.volumeSlug}:${entry.scheduleSlug}`)).toEqual([
      "essencia:terca_quinta",
      "essencia:sabado",
      "caminho:terca_quinta",
      "caminho:sabado",
      "voz:terca_quinta",
      "voz:sabado",
    ]);
    expect(stats.byStatus.map((s) => s.status)).toEqual([
      "pending",
      "approved",
      "rejected",
      "cancelled",
    ]);
    expect(stats.byGrNetwork.map((n) => n.slug)).toEqual([
      "antonio_carlos",
      "ranyere_araujo",
      "alvaro_henrique_huios",
      "matheus_soares_folk",
      "vitor_motta_slaves",
    ]);
    expect(stats.otherChurchMemberCount).toBe(0);
    expect(stats.emausMemberCount).toBe(0);
    expect(stats.noGrCount).toBe(0);
  });

  it("conta outra igreja, membros da Emaús e rede de GR", () => {
    const rows: EnrollmentStatsRow[] = [
      row({ isOtherChurchMember: true, isEmausMember: false }),
      row({ isOtherChurchMember: false, isEmausMember: true, hasGr: false }),
      row({
        isOtherChurchMember: false,
        isEmausMember: true,
        hasGr: true,
        grNetworkSlug: "vitor_motta_slaves",
      }),
      row({
        isOtherChurchMember: false,
        isEmausMember: true,
        hasGr: true,
        grNetworkSlug: "vitor_motta_slaves",
      }),
      row({}), // legado: perguntas nulas, não deve contar em nenhum bucket
    ];

    const stats = computeEnrollmentStats(rows, NOW);

    expect(stats.otherChurchMemberCount).toBe(1);
    expect(stats.emausMemberCount).toBe(3);
    expect(stats.noGrCount).toBe(1);
    expect(stats.byGrNetwork.find((n) => n.slug === "vitor_motta_slaves")?.count).toBe(2);
    expect(stats.byGrNetwork.find((n) => n.slug === "antonio_carlos")?.count).toBe(0);
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
