import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf, normalizeCpf } from "@/services/cpf";

describe("CPF", () => {
  it("normaliza e formata", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("aceita dígitos verificadores válidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF inválido e sequência repetida", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});

