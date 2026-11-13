import { describe, expect, it } from "vitest";
import {
  DEADLINE_CLOSED_MESSAGE,
  formatReleaseDeadline,
  isBlockedByDeadline,
  isPastDeadline,
  isReleaseActive,
  lateReleaseMessage,
} from "@/modules/assessment/lateRelease";

const now = new Date("2026-11-13T15:00:00Z");
const past = "2026-11-12T23:59:00Z";
const future = "2026-11-20T23:59:00Z";
const releaseOk = "2026-11-14T15:00:00Z";
const releaseOld = "2026-11-13T14:59:00Z";

describe("regra do prazo com liberação (espelha start_assessment_attempt)", () => {
  it("sem liberação e prazo vencido: barra", () => {
    expect(isBlockedByDeadline(past, null, now)).toBe(true);
    expect(isBlockedByDeadline(past, undefined, now)).toBe(true);
  });
  it("com liberação válida: não barra", () => {
    expect(isBlockedByDeadline(past, releaseOk, now)).toBe(false);
  });
  it("liberação vencida: barra de novo", () => {
    expect(isBlockedByDeadline(past, releaseOld, now)).toBe(true);
    expect(isReleaseActive(releaseOld, now)).toBe(false);
  });
  it("liberação que vence exatamente agora já não vale", () => {
    expect(isReleaseActive(now.toISOString(), now)).toBe(false);
  });
  it("dentro do prazo (ou sem prazo) nada muda, com ou sem liberação", () => {
    expect(isBlockedByDeadline(future, null, now)).toBe(false);
    expect(isBlockedByDeadline(future, releaseOk, now)).toBe(false);
    expect(isBlockedByDeadline(null, null, now)).toBe(false);
    expect(isPastDeadline(null, now)).toBe(false);
  });
});

describe("texto para o aluno", () => {
  it("diz até quando vale, no horário de Brasília", () => {
    expect(lateReleaseMessage("2026-11-14T13:30:00Z")).toBe("Prova liberada para você até 14/11 às 10:30.");
  });
  it("vira o dia certo perto da meia-noite de Brasília", () => {
    expect(formatReleaseDeadline("2026-11-14T02:30:00Z")).toBe("13/11 às 23:30");
  });
  it("as frases não têm travessão", () => {
    expect(DEADLINE_CLOSED_MESSAGE).not.toMatch(/[—–]/);
    expect(lateReleaseMessage(releaseOk)).not.toMatch(/[—–]/);
  });
});
