import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/services/cpf";

const volumeSchema = z.enum(["essencia", "caminho", "voz"]);
const scheduleSchema = z.enum(["terca_quinta", "sabado"]);
const grNetworkSchema = z.enum([
  "antonio_carlos",
  "ranyere_araujo",
  "alvaro_henrique_huios",
  "matheus_soares_folk",
  "vitor_motta_slaves",
]);

export const enrollmentRequestSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo.").max(150),
    cpf: z.string().transform(normalizeCpf).refine(isValidCpf, "Informe um CPF válido."),
    email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length >= 10 && value.length <= 11, "Informe um WhatsApp válido."),
    primaryVolume: volumeSchema,
    primarySchedule: scheduleSchema,
    wantsSecondVolume: z.boolean(),
    secondaryVolume: z.union([volumeSchema, z.literal("")]).optional(),
    secondarySchedule: z.union([scheduleSchema, z.literal("")]).optional(),
    prerequisiteDeclaration: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    isOtherChurchMember: z.boolean({ error: "Informe se você faz parte de outra igreja." }),
    otherChurchName: z.string().trim().max(150).optional(),
    isEmausMember: z.boolean({ error: "Informe se você faz parte da Igreja Emaús." }),
    hasGr: z.boolean().optional(),
    grNetwork: z.union([grNetworkSchema, z.literal("")]).optional(),
    privacyConsent: z.literal(true, { error: "Você precisa autorizar o tratamento dos dados." }),
    website: z.string().max(200).optional(),
  })
  .superRefine((data, context) => {
    if (data.wantsSecondVolume) {
      if (!data.secondaryVolume) {
        context.addIssue({ code: "custom", path: ["secondaryVolume"], message: "Selecione o segundo volume." });
      } else if (data.secondaryVolume === data.primaryVolume) {
        context.addIssue({ code: "custom", path: ["secondaryVolume"], message: "Escolha um volume diferente do principal." });
      }

      if (!data.secondarySchedule) {
        context.addIssue({ code: "custom", path: ["secondarySchedule"], message: "Selecione o horário do segundo volume." });
      } else if (data.secondarySchedule === data.primarySchedule) {
        context.addIssue({ code: "custom", path: ["secondarySchedule"], message: "Os dois volumes precisam ser cursados em horários diferentes." });
      }
    }

    const needsDeclaration =
      data.primaryVolume !== "essencia" || data.wantsSecondVolume;
    if (needsDeclaration && (!data.prerequisiteDeclaration || data.prerequisiteDeclaration.length < 10)) {
      context.addIssue({
        code: "custom",
        path: ["prerequisiteDeclaration"],
        message: "Explique seu histórico ou o motivo da solicitação (mínimo 10 caracteres).",
      });
    }

    if (data.isEmausMember) {
      if (data.hasGr === undefined) {
        context.addIssue({
          code: "custom",
          path: ["hasGr"],
          message: "Informe se você participa de um GR.",
        });
      } else if (data.hasGr && !data.grNetwork) {
        context.addIssue({
          code: "custom",
          path: ["grNetwork"],
          message: "Selecione a rede do seu GR.",
        });
      }
    }
  });

export type EnrollmentRequestInput = z.infer<typeof enrollmentRequestSchema>;
