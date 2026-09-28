import { describe, expect, it } from "vitest";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/services/phone";

describe("formatBrazilianPhone", () => {
  it("formata celular (11 dígitos) com máscara", () => {
    expect(formatBrazilianPhone("62999999999")).toBe("(62) 99999-9999");
  });

  it("formata fixo (10 dígitos) com máscara", () => {
    expect(formatBrazilianPhone("6233334444")).toBe("(62) 3333-4444");
  });

  it("remove o código do país antes de formatar", () => {
    expect(formatBrazilianPhone("5562999999999")).toBe("(62) 99999-9999");
  });

  it("nunca inventa formatação para um valor não reconhecido", () => {
    expect(formatBrazilianPhone("123")).toBe("123");
  });
});

describe("isValidBrazilianPhone", () => {
  it("aceita celular e fixo", () => {
    expect(isValidBrazilianPhone("62999999999")).toBe(true);
    expect(isValidBrazilianPhone("6233334444")).toBe(true);
  });

  it("rejeita número incompleto", () => {
    expect(isValidBrazilianPhone("6299999")).toBe(false);
  });
});
