import { describe, expect, it } from "vitest";
import { resolveFinalGrade } from "@/services/finalGrade";

describe("resolveFinalGrade", () => {
  it("usa a nota regular quando não há recuperação", () => {
    expect(resolveFinalGrade(7, null)).toBe(7);
  });

  it("a recuperação substitui a regular quando é maior", () => {
    expect(resolveFinalGrade(4, 8)).toBe(8);
  });

  it("a regular permanece quando é maior que a recuperação", () => {
    expect(resolveFinalGrade(7, 5)).toBe(7);
  });

  it("empate mantém o valor (max é idempotente)", () => {
    expect(resolveFinalGrade(6, 6)).toBe(6);
  });

  it("nenhuma tentativa ainda feita resulta em null", () => {
    expect(resolveFinalGrade(null, null)).toBeNull();
  });
});
