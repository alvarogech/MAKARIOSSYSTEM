import { describe, expect, it } from "vitest";
import { enrollmentRequestSchema } from "@/modules/enrollment/schemas";

const baseRequest = {
  fullName: "Pessoa de Teste",
  cpf: "529.982.247-25",
  email: "pessoa@teste.local",
  phone: "62999999999",
  primaryVolume: "essencia",
  primarySchedule: "terca_quinta",
  wantsSecondVolume: false,
  secondaryVolume: "",
  secondarySchedule: "",
  prerequisiteDeclaration: "",
  notes: "",
  privacyConsent: true,
  enrollmentAwareness: true,
  website: "",
};

describe("enrollmentRequestSchema", () => {
  it("aceita uma solicitação de Essência", () => {
    expect(enrollmentRequestSchema.safeParse(baseRequest).success).toBe(true);
  });

  it("exige declaração para Caminho", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      primaryVolume: "caminho",
    });
    expect(result.success).toBe(false);
  });

  it("aceita dois volumes em horários diferentes com justificativa", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      wantsSecondVolume: true,
      secondaryVolume: "caminho",
      secondarySchedule: "sabado",
      prerequisiteDeclaration: "Quero cursar os dois volumes simultaneamente.",
    });
    expect(result.success).toBe(true);
  });

  it("bloqueia volumes e horários repetidos", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      wantsSecondVolume: true,
      secondaryVolume: "essencia",
      secondarySchedule: "terca_quinta",
      prerequisiteDeclaration: "Solicitação simultânea para este período.",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.secondaryVolume).toBeDefined();
      expect(errors.secondarySchedule).toBeDefined();
    }
  });

  it("exige os dois consentimentos", () => {
    expect(
      enrollmentRequestSchema.safeParse({
        ...baseRequest,
        privacyConsent: false,
        enrollmentAwareness: false,
      }).success,
    ).toBe(false);
  });
});

