import { describe, expect, it } from "vitest";
import { evaluateAnswerKeyRelease } from "@/services/answerKeyRelease";

const baseInput = {
  now: new Date("2026-10-20T12:00:00Z"),
  closesAt: new Date("2026-11-01T00:00:00Z"),
  manuallyReleased: false,
  eligibleCount: 10,
  submittedCount: 0,
};

describe("evaluateAnswerKeyRelease", () => {
  it("não libera enquanto nenhuma condição é satisfeita", () => {
    expect(evaluateAnswerKeyRelease(baseInput)).toBeNull();
  });

  it("libera por liberação manual, mesmo que nada mais esteja satisfeito", () => {
    expect(
      evaluateAnswerKeyRelease({ ...baseInput, manuallyReleased: true }),
    ).toBe("manual");
  });

  it("libera quando todos os elegíveis enviaram", () => {
    expect(
      evaluateAnswerKeyRelease({ ...baseInput, submittedCount: 10 }),
    ).toBe("all_submitted");
  });

  it("não libera por 'todos enviaram' se o conjunto de elegíveis estiver vazio", () => {
    expect(
      evaluateAnswerKeyRelease({ ...baseInput, eligibleCount: 0, submittedCount: 0 }),
    ).toBeNull();
  });

  it("libera quando o prazo já encerrou", () => {
    expect(
      evaluateAnswerKeyRelease({
        ...baseInput,
        now: new Date("2026-11-02T00:00:00Z"),
      }),
    ).toBe("deadline");
  });

  it("manual tem prioridade sobre as outras condições quando mais de uma é satisfeita", () => {
    expect(
      evaluateAnswerKeyRelease({
        ...baseInput,
        manuallyReleased: true,
        submittedCount: 10,
        now: new Date("2026-11-02T00:00:00Z"),
      }),
    ).toBe("manual");
  });

  it("uma matrícula tardia (fora do conjunto fixo de elegíveis) nunca atrasa a liberação por 'todos enviaram'", () => {
    // eligibleCount reflete o conjunto CONGELADO na publicação — mesmo que
    // existam mais matrículas agora, o cálculo usa o tamanho fixo.
    expect(
      evaluateAnswerKeyRelease({ ...baseInput, eligibleCount: 3, submittedCount: 3 }),
    ).toBe("all_submitted");
  });
});
