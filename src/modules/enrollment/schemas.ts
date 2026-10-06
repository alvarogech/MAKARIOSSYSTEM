import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/services/cpf";
import { passwordRules } from "@/modules/auth/schemas";

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
    fullName: z.string().trim().min(3, "Preencha seu nome completo.").max(150),
    cpf: z
      .string()
      .transform(normalizeCpf)
      .refine((value) => value.length > 0, "Preencha o CPF.")
      .refine((value) => value.length === 0 || isValidCpf(value), "CPF inválido — confira os 11 números."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Preencha o e-mail.")
      .email("E-mail inválido — confira se tem @ e o final (ex.: nome@gmail.com).")
      .max(254),
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length > 0, "Preencha o WhatsApp.")
      .refine(
        (value) => value.length === 0 || (value.length >= 10 && value.length <= 11),
        "WhatsApp incompleto — informe com DDD, ex.: (62) 99999-9999.",
      ),
    primaryVolume: volumeSchema,
    primarySchedule: scheduleSchema,
    wantsSecondVolume: z.boolean(),
    secondaryVolume: z.union([volumeSchema, z.literal("")]).optional(),
    secondarySchedule: z.union([scheduleSchema, z.literal("")]).optional(),
    prerequisiteDeclaration: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    isOtherChurchMember: z.boolean({ error: "Responda se você faz parte de outra igreja (Sim ou Não)." }),
    otherChurchName: z.string().trim().max(150).optional(),
    isEmausMember: z.boolean({ error: "Responda se você faz parte da Igreja Emaús (Sim ou Não)." }),
    hasGr: z.boolean().optional(),
    grNetwork: z.union([grNetworkSchema, z.literal("")]).optional(),
    privacyConsent: z.literal(true, { error: "Marque a caixa de autorização dos dados para enviar a inscrição." }),
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
          message: "Responda se você tem GR (Sim ou Não).",
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

export const acceptStudentInvitationSchema = z
  .object({
    token: z.string().min(1),
    fullName: z.string().trim().min(1, "Informe o nome completo."),
    // Editável pelo mesmo motivo do convite de professor: a coordenação
    // pode não ter o e-mail certo na hora da aprovação.
    email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
    password: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type AcceptStudentInvitationInput = z.infer<typeof acceptStudentInvitationSchema>;
