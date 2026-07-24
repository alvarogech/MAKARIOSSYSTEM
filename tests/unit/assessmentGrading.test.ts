import { describe, expect, it } from "vitest";
import {
  calculateAssessmentScore,
  isGradeSufficient,
} from "@/services/assessmentGrading";

describe("calculateAssessmentScore", () => {
  it("soma os pontos das questões corretas até o total da avaliação", () => {
    const correctByQuestion = new Map<string, string[]>([
      ["q1", ["a"]],
      ["q2", ["b"]],
      ["q3", ["c", "d"]], // "marque todas as corretas"
    ]);

    const result = calculateAssessmentScore(
      [
        { questionId: "q1", selectedOptionIds: ["a"], points: 0.5 },
        { questionId: "q2", selectedOptionIds: ["x"], points: 0.5 }, // errada
        { questionId: "q3", selectedOptionIds: ["c", "d"], points: 0.5 },
      ],
      correctByQuestion,
    );

    expect(result.score).toBe(1);
    expect(result.correctCount).toBe(2);
  });

  it("20 questões de peso igual (0,5 cada) somam 10 quando todas corretas", () => {
    const correctByQuestion = new Map<string, string[]>(
      Array.from({ length: 20 }, (_, i) => [`q${i}`, ["a"]]),
    );
    const answers = Array.from({ length: 20 }, (_, i) => ({
      questionId: `q${i}`,
      selectedOptionIds: ["a"],
      points: 0.5,
    }));

    const result = calculateAssessmentScore(answers, correctByQuestion);
    expect(result.score).toBe(10);
    expect(result.correctCount).toBe(20);
  });

  it("questão não respondida (ausente da lista de respostas) não pontua", () => {
    const correctByQuestion = new Map<string, string[]>([["q1", ["a"]]]);
    const result = calculateAssessmentScore([], correctByQuestion);
    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
  });

  it("questão sem gabarito no mapa nunca pontua (fail closed)", () => {
    const result = calculateAssessmentScore(
      [{ questionId: "q-orfa", selectedOptionIds: ["a"], points: 0.5 }],
      new Map(),
    );
    expect(result.score).toBe(0);
  });
});

describe("isGradeSufficient", () => {
  it("6,0 é suficiente (limite exato do padrão)", () => {
    expect(isGradeSufficient(6)).toBe(true);
  });

  it("5,9 não é suficiente", () => {
    expect(isGradeSufficient(5.9)).toBe(false);
  });

  it("respeita uma nota mínima customizada", () => {
    expect(isGradeSufficient(5, 4)).toBe(true);
  });
});
