import { describe, expect, it } from "vitest";
import { checkEnrollmentDataQuality } from "@/modules/enrollment/dataQuality";

describe("checkEnrollmentDataQuality", () => {
  it("não sinaliza nada para dados válidos e comuns", () => {
    expect(checkEnrollmentDataQuality({ email: "pessoa@gmail.com", phone: "62999999999" })).toEqual([]);
  });

  it("sugere correção para domínio parecido com um comum, mas não idêntico", () => {
    const flags = checkEnrollmentDataQuality({ email: "pessoa@gmqil.com", phone: "62999999999" });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.field).toBe("email");
    expect(flags[0]?.suggestion).toContain("gmail.com");
  });

  it("não sugere nada para um domínio real e diferente (evita falso positivo)", () => {
    const flags = checkEnrollmentDataQuality({ email: "pessoa@empresaqualquer.com.br", phone: "62999999999" });
    expect(flags).toEqual([]);
  });

  it("sinaliza e-mail sem estrutura válida", () => {
    const flags = checkEnrollmentDataQuality({ email: "pessoa-sem-arroba.com", phone: "62999999999" });
    expect(flags.some((f) => f.field === "email")).toBe(true);
  });

  it("sinaliza telefone incompleto", () => {
    const flags = checkEnrollmentDataQuality({ email: "pessoa@gmail.com", phone: "6299999" });
    expect(flags.some((f) => f.field === "phone")).toBe(true);
  });
});
