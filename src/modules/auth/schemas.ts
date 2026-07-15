import { z } from "zod";

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

const passwordRules = z
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
