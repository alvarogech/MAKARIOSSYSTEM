import { describe, expect, it } from "vitest";
import {
  addSaoPauloDays,
  formatSaoPauloDateTime,
  formatSaoPauloLongDate,
  formatSaoPauloTimeRange,
  getSaoPauloDateKey,
  saoPauloWallTimeToUtc,
  startOfSaoPauloDay,
  startOfSaoPauloDayFromKey,
  startOfSaoPauloMonth,
  startOfSaoPauloWeek,
} from "@/lib/saoPauloDate";

describe("saoPauloDate", () => {
  it("calcula a chave do dia em São Paulo a partir de um instante UTC", () => {
    // 2026-03-10T02:30:00Z é ainda 2026-03-09 à noite em São Paulo (UTC-3).
    expect(getSaoPauloDateKey(new Date("2026-03-10T02:30:00Z"))).toBe("2026-03-09");
    expect(getSaoPauloDateKey(new Date("2026-03-10T04:00:00Z"))).toBe("2026-03-10");
  });

  it("início do dia em São Paulo corresponde a 03:00 UTC", () => {
    const start = startOfSaoPauloDay(new Date("2026-03-10T15:00:00Z"));
    expect(start.toISOString()).toBe("2026-03-10T03:00:00.000Z");
  });

  it("início da semana cai numa segunda-feira", () => {
    // 2026-03-12 é uma quinta-feira.
    const start = startOfSaoPauloWeek(new Date("2026-03-12T15:00:00Z"));
    expect(getSaoPauloDateKey(start)).toBe("2026-03-09"); // segunda anterior
  });

  it("início do mês cai no dia 1", () => {
    const start = startOfSaoPauloMonth(new Date("2026-03-27T15:00:00Z"));
    expect(getSaoPauloDateKey(start)).toBe("2026-03-01");
  });

  it("soma dias preservando o instante em UTC", () => {
    const base = new Date("2026-03-10T03:00:00.000Z");
    expect(addSaoPauloDays(base, 1).toISOString()).toBe("2026-03-11T03:00:00.000Z");
  });

  it("formata data e hora no padrão brasileiro", () => {
    expect(formatSaoPauloDateTime("2026-03-10T15:05:00Z")).toBe("10/03/2026 12:05");
  });

  it("recupera o início do dia a partir da chave (inverso de getSaoPauloDateKey)", () => {
    expect(startOfSaoPauloDayFromKey("2026-03-10").toISOString()).toBe("2026-03-10T03:00:00.000Z");
    expect(getSaoPauloDateKey(startOfSaoPauloDayFromKey("2026-03-10"))).toBe("2026-03-10");
  });

  it("formata data longa em pt-BR a partir de uma chave de dia", () => {
    // 2026-10-03 é um sábado.
    expect(formatSaoPauloLongDate("2026-10-03")).toBe("sábado, 3 de outubro de 2026");
    expect(formatSaoPauloLongDate("2026-10-03", { capitalize: true })).toBe(
      "Sábado, 3 de outubro de 2026",
    );
  });

  it("formata intervalo de horário, com ou sem um dos lados", () => {
    expect(formatSaoPauloTimeRange("08:00:00", "12:30:00")).toBe("08:00 – 12:30");
    expect(formatSaoPauloTimeRange("08:00:00", null)).toBe("08:00");
    expect(formatSaoPauloTimeRange(null, "12:30:00")).toBe("12:30");
    expect(formatSaoPauloTimeRange(null, null)).toBe("");
  });

  it("converte data+hora de parede em São Paulo para o instante UTC correto", () => {
    // 08:00 em São Paulo (UTC-3, sem horário de verão desde 2019) = 11:00 UTC.
    expect(saoPauloWallTimeToUtc("2026-10-03", "08:00").toISOString()).toBe("2026-10-03T11:00:00.000Z");
    expect(saoPauloWallTimeToUtc("2026-10-03", "12:30").toISOString()).toBe("2026-10-03T15:30:00.000Z");
  });
});
