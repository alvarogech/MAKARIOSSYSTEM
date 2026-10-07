import { describe, expect, it } from "vitest";
import { stageOf, worstSituation, type FunnelInput } from "@/modules/academic/studentFunnel";

const base: FunnelInput = {
  requestStatus: "approved",
  hasAccount: true,
  lastSignInAt: "2026-10-05T10:00:00Z",
  enrollmentStatuses: ["active"],
  situation: "em_dia",
  attendedMinutes: 0,
};

describe("stageOf", () => {
  it("inscrição pendente é 'inscrito'; recusada/cancelada sai do funil", () => {
    expect(stageOf({ ...base, requestStatus: "pending" })).toBe("inscrito");
    expect(stageOf({ ...base, requestStatus: "rejected" })).toBe("encerrada");
    expect(stageOf({ ...base, requestStatus: "cancelled" })).toBe("encerrada");
  });

  it("aprovado sem conta, depois conta criada sem entrar", () => {
    expect(stageOf({ ...base, hasAccount: false, lastSignInAt: null, enrollmentStatuses: [] })).toBe("aprovado");
    expect(stageOf({ ...base, lastSignInAt: null, enrollmentStatuses: [] })).toBe("conta_criada");
  });

  it("matriculado até aparecer a primeira presença; depois frequentando", () => {
    expect(stageOf(base)).toBe("matriculado");
    expect(stageOf({ ...base, attendedMinutes: 120 })).toBe("frequentando");
  });

  it("risco de frequência prevalece sobre frequentando", () => {
    expect(stageOf({ ...base, attendedMinutes: 120, situation: "no_limite" })).toBe("em_risco");
    expect(stageOf({ ...base, attendedMinutes: 120, situation: "reprovado" })).toBe("em_risco");
    expect(stageOf({ ...base, attendedMinutes: 120, situation: "atencao" })).toBe("frequentando");
  });

  it("concluído e não aprovado vêm do status da matrícula", () => {
    expect(stageOf({ ...base, enrollmentStatuses: ["approved"] })).toBe("concluido");
    expect(stageOf({ ...base, enrollmentStatuses: ["failed"] })).toBe("nao_aprovado");
    expect(stageOf({ ...base, enrollmentStatuses: ["approved", "active"] })).toBe("matriculado");
  });
});

describe("worstSituation", () => {
  const p = (situation: "em_dia" | "atencao" | "no_limite" | "reprovado") => ({
    progress: { situation } as never,
  });
  it("pega a pior entre as turmas", () => {
    expect(worstSituation([p("em_dia"), p("no_limite")])).toBe("no_limite");
    expect(worstSituation([p("atencao"), p("reprovado"), p("em_dia")])).toBe("reprovado");
    expect(worstSituation([])).toBeNull();
  });
});
