import { describe, expect, it } from "vitest";
import {
  DEADLINE_CLOSED_MESSAGE,
  HAD_ATTEMPT_MESSAGE,
  RELEASE_EXPIRED_MESSAGE,
  canStartOrContinue,
  lateReleaseView,
  toBrasiliaInputValue,
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

describe("o que o aluno vê (espelha request_late_release)", () => {
  const base = { closesAt: past, requestsUntil: "2026-11-13T23:59:00Z", releaseValidUntil: null, attemptsUsed: 0, now };
  it("dentro do prazo ou sem prazo: nada a mostrar", () => {
    expect(lateReleaseView({ ...base, closesAt: future })).toBe("none");
    expect(lateReleaseView({ ...base, closesAt: null })).toBe("none");
  });
  it("sem tentativa, prazo vencido e janela aberta: pode pedir", () => {
    expect(lateReleaseView(base)).toBe("request");
  });
  it("janela desligada ou encerrada: só a coordenação ajuda", () => {
    expect(lateReleaseView({ ...base, requestsUntil: null })).toBe("closed");
    expect(lateReleaseView({ ...base, requestsUntil: "2026-11-13T14:00:00Z" })).toBe("closed");
  });
  it("quem já tem tentativa não pede", () => {
    expect(lateReleaseView({ ...base, attemptsUsed: 1 })).toBe("had_attempt");
  });
  it("liberação ativa: liberada; vencida: o prazo de 24 horas terminou (e não pede de novo)", () => {
    expect(lateReleaseView({ ...base, releaseValidUntil: releaseOk })).toBe("released");
    expect(lateReleaseView({ ...base, releaseValidUntil: releaseOld })).toBe("expired");
    expect(lateReleaseView({ ...base, releaseValidUntil: releaseOld, requestsUntil: "2026-11-20T00:00:00Z" })).toBe("expired");
  });
  it("as frases não têm travessão", () => {
    expect(HAD_ATTEMPT_MESSAGE).toBe("Você já fez esta avaliação. Se precisar de ajuda, fale com a coordenação da Escola Makários.");
    for (const m of [HAD_ATTEMPT_MESSAGE, RELEASE_EXPIRED_MESSAGE]) expect(m).not.toMatch(/[—–]/);
  });
  it("campo da coordenação mostra o horário de Brasília", () => {
    expect(toBrasiliaInputValue("2026-11-14T02:59:00Z")).toBe("2026-11-13T23:59");
  });
});

describe("liberação não dá tentativa extra (revisão do Léo, C1)", () => {
  const base = { closesAt: past, requestsUntil: null, releaseValidUntil: releaseOk, attemptsUsed: 0, now };
  it("canStartOrContinue: sobrou tentativa ou há uma em andamento", () => {
    expect(canStartOrContinue({ attemptsUsed: 0, attemptsAllowed: 1, hasInProgress: false })).toBe(true);
    expect(canStartOrContinue({ attemptsUsed: 1, attemptsAllowed: 1, hasInProgress: false })).toBe(false);
    expect(canStartOrContinue({ attemptsUsed: 1, attemptsAllowed: 1, hasInProgress: true })).toBe(true);
    expect(canStartOrContinue({ attemptsUsed: 1, attemptsAllowed: 2, hasInProgress: false })).toBe(true);
    expect(canStartOrContinue({ attemptsUsed: 2, attemptsAllowed: 2, hasInProgress: false })).toBe(false);
  });
  it("liberação ativa e ainda pode iniciar: liberada (faixa verde)", () => {
    expect(lateReleaseView(base)).toBe("released");
    expect(lateReleaseView({ ...base, attemptsUsed: 1, attemptsAllowed: 2 })).toBe("released");
    expect(lateReleaseView({ ...base, attemptsUsed: 1, hasInProgress: true })).toBe("released");
  });
  it("liberação ativa mas já usou as tentativas: sem faixa verde", () => {
    expect(lateReleaseView({ ...base, attemptsUsed: 1 })).toBe("had_attempt");
    expect(lateReleaseView({ ...base, attemptsUsed: 2, attemptsAllowed: 2 })).toBe("had_attempt");
  });
  it("o pedido do próprio aluno só existe sem nenhuma tentativa (coerente com a regra acima)", () => {
    const open = { closesAt: past, requestsUntil: "2026-11-13T23:59:00Z", releaseValidUntil: null, now };
    expect(lateReleaseView({ ...open, attemptsUsed: 0 })).toBe("request");
    expect(lateReleaseView({ ...open, attemptsUsed: 1 })).toBe("had_attempt");
  });
});
