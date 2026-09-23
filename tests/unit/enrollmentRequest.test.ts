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
  isOtherChurchMember: false,
  otherChurchName: "",
  isEmausMember: false,
  hasGr: undefined,
  grNetwork: "",
  privacyConsent: true,
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

  it("exige o consentimento de privacidade", () => {
    expect(
      enrollmentRequestSchema.safeParse({
        ...baseRequest,
        privacyConsent: false,
      }).success,
    ).toBe(false);
  });

  it("exige resposta sobre outra igreja e sobre a Emaús", () => {
    const { isOtherChurchMember: _isOtherChurchMember, ...withoutOtherChurch } = baseRequest;
    expect(enrollmentRequestSchema.safeParse(withoutOtherChurch).success).toBe(false);

    const { isEmausMember: _isEmausMember, ...withoutEmaus } = baseRequest;
    expect(enrollmentRequestSchema.safeParse(withoutEmaus).success).toBe(false);
  });

  it("exige informar se tem GR quando é membro da Emaús", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      isEmausMember: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.hasGr).toBeDefined();
    }
  });

  it("exige a rede quando a pessoa tem GR", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      isEmausMember: true,
      hasGr: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.grNetwork).toBeDefined();
    }
  });

  it("aceita membro da Emaús com GR e rede informados", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      isEmausMember: true,
      hasGr: true,
      grNetwork: "vitor_motta_slaves",
    });
    expect(result.success).toBe(true);
  });

  it("não exige rede quando a pessoa não tem GR", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      isEmausMember: true,
      hasGr: false,
    });
    expect(result.success).toBe(true);
  });

  it("não exige pergunta de GR quando não é membro da Emaús", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...baseRequest,
      isEmausMember: false,
    });
    expect(result.success).toBe(true);
  });
});

