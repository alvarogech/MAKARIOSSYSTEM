import { z } from "zod";
import { isValidBrazilianPhone } from "@/services/phone";

/**
 * Zod é usado exclusivamente para validar o FORMATO dos dados de entrada
 * — nunca para decidir autorização (isso é responsabilidade de
 * `src/authorization`). Ver PLANO_TECNICO.md seção 6/10.
 */

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordRules = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .regex(/[a-z]/, "A senha precisa ter pelo menos uma letra minúscula.")
  .regex(/[A-Z]/, "A senha precisa ter pelo menos uma letra maiúscula.")
  .regex(/[0-9]/, "A senha precisa ter pelo menos um número.");

export const setPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, {
      message: "É necessário aceitar os termos de uso para continuar.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
});

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;

export const createInvitationSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  fullName: z.string().trim().min(1, "Informe o nome completo."),
  roleSlug: z.enum([
    "student",
    "teacher",
    "coordinator",
    "admin",
    "content_editor",
  ]),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

// Reaproveita o mesmo validador usado no dashboard de inscrições — nunca
// duplicar a regra de "o que é um telefone brasileiro válido".
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Informe o WhatsApp com DDD.")
  .refine(isValidBrazilianPhone, {
    message: "Informe um WhatsApp válido com DDD (ex.: 62 99999-9999).",
  });

export const createTeacherInvitationSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome completo."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  phone: phoneSchema,
  // Aulas específicas (class_meeting_blocks), não turmas inteiras — o
  // painel do professor só mostra uma aula quando o teacher_id do bloco
  // aponta pra ele, então é isso que precisa ser escolhido na hora do
  // convite, não só "em qual turma a pessoa está".
  meetingBlockIds: z.array(z.string().uuid()).default([]),
});

export type CreateTeacherInvitationInput = z.infer<
  typeof createTeacherInvitationSchema
>;

export const acceptTeacherInvitationSchema = z
  .object({
    token: z.string().min(1),
    fullName: z.string().trim().min(1, "Informe o nome completo."),
    // Editável: a coordenação pode não saber o e-mail real na hora de gerar
    // o convite (ex.: usar um e-mail institucional provisório) — quem
    // aceita confirma ou corrige aqui, e é esse valor que vira o e-mail de
    // login de fato.
    email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
    phone: phoneSchema,
    password: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type AcceptTeacherInvitationInput = z.infer<
  typeof acceptTeacherInvitationSchema
>;

export const acceptAssistedResetSchema = z
  .object({
    token: z.string().min(1),
    password: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type AcceptAssistedResetInput = z.infer<typeof acceptAssistedResetSchema>;
