import { describe, expect, it } from "vitest";
import {
  addSaoPauloDays,
  formatSaoPauloDateTime,
  getSaoPauloDateKey,
  startOfSaoPauloDay,
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
});
