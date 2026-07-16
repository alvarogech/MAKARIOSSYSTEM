import { describe, expect, it } from "vitest";
import { gradeActivityAttempt, isAnswerCorrect } from "@/services/activityGrading";

describe("isAnswerCorrect", () => {
  it("correta quando o conjunto selecionado é exatamente o conjunto certo (múltipla escolha simples)", () => {
    expect(isAnswerCorrect(["a"], ["a"])).toBe(true);
  });

  it("incorreta quando a alternativa selecionada é diferente da correta", () => {
    expect(isAnswerCorrect(["b"], ["a"])).toBe(false);
  });

  it("correta quando todas as opções certas de uma questão multi-seleção foram marcadas, sem sobra", () => {
    expect(isAnswerCorrect(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("incorreta quando falta uma opção certa", () => {
    expect(isAnswerCorrect(["a"], ["a", "b"])).toBe(false);
  });

  it("incorreta quando há uma opção a mais além das certas", () => {
    expect(isAnswerCorrect(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("nenhuma opção selecionada nunca é considerada correta", () => {
    expect(isAnswerCorrect([], ["a"])).toBe(false);
  });
});

describe("gradeActivityAttempt", () => {
  it("corrige um conjunto de respostas e soma os acertos", () => {
    const correctByQuestion = new Map<string, string[]>([
      ["q1", ["opt-a"]],
      ["q2", ["opt-c"]],
      ["q3", ["opt-e", "opt-f"]],
    ]);

    const result = gradeActivityAttempt(
      [
        { questionId: "q1", selectedOptionIds: ["opt-a"] }, // certa
        { questionId: "q2", selectedOptionIds: ["opt-d"] }, // errada
        { questionId: "q3", selectedOptionIds: ["opt-e", "opt-f"] }, // certa
      ],
      correctByQuestion,
    );

    expect(result.correctCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.answers).toEqual([
      { questionId: "q1", isCorrect: true },
      { questionId: "q2", isCorrect: false },
      { questionId: "q3", isCorrect: true },
    ]);
  });

  it("questão sem gabarito cadastrado nunca conta como acerto (fail closed)", () => {
    const result = gradeActivityAttempt(
      [{ questionId: "q-sem-gabarito", selectedOptionIds: ["opt-a"] }],
      new Map(),
    );
    expect(result.correctCount).toBe(0);
  });
});
