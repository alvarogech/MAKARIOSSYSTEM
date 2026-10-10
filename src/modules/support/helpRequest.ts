import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/services/cpf";

/** Opções da página /ajuda. A ordem é a da tela; o código é o que vai para o banco. */
export const HELP_PROBLEMS = [
  { code: "login", label: "Não consigo entrar (login ou senha)" },
  { code: "convite", label: "Não recebi o e-mail, ou o link do convite não funciona" },
  { code: "turma_errada", label: "Estou no volume ou na turma errada" },
  { code: "dados_errados", label: "Meu nome ou meus dados estão errados" },
  { code: "chamada_erro", label: "A chamada pelo QR Code deu erro" },
  { code: "chamada_longe", label: "A chamada diz que estou longe do local" },
  { code: "presenca_faltando", label: "Minha presença não apareceu, ou tenho falta que não devia" },
  { code: "outro", label: "Outro problema" },
] as const;

export type HelpProblemCode = (typeof HELP_PROBLEMS)[number]["code"];

const CODES = HELP_PROBLEMS.map((p) => p.code) as [HelpProblemCode, ...HelpProblemCode[]];

export const helpProblemLabel = (code: string) => HELP_PROBLEMS.find((p) => p.code === code)?.label ?? code;

const helpRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, "Digite o seu nome completo.").max(120, "Nome longo demais."),
    cpf: z.string().refine(isValidCpf, "CPF inválido. Confira os números."),
    phone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length >= 10 && v.length <= 13, "Digite o WhatsApp com DDD."),
    problems: z.array(z.enum(CODES)).max(CODES.length),
    message: z
      .string()
      .trim()
      .max(2000, "A mensagem passou de 2.000 caracteres.")
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => v.problems.length > 0 || v.message !== null, {
    message: "Marque um problema ou escreva o que está acontecendo.",
    path: ["problems"],
  })
  .refine((v) => !v.problems.includes("outro") || v.message !== null, {
    message: "Você marcou “Outro problema”: conte no espaço em branco o que está acontecendo.",
    path: ["message"],
  });

export type HelpRequestInput = {
  fullName: string;
  cpf: string;
  phone: string;
  problems: HelpProblemCode[];
  message: string | null;
};

export type ParseResult = { ok: true; data: HelpRequestInput } | { ok: false; errors: Record<string, string> };

/** Validação do pedido (pura e testável): o servidor sempre passa por aqui antes de gravar. */
export function parseHelpRequest(raw: {
  fullName: unknown;
  cpf: unknown;
  phone: unknown;
  problems: unknown[];
  message: unknown;
}): ParseResult {
  const result = helpRequestSchema.safeParse({
    fullName: String(raw.fullName ?? ""),
    cpf: String(raw.cpf ?? ""),
    phone: String(raw.phone ?? ""),
    problems: [...new Set(raw.problems.map(String))],
    message: String(raw.message ?? ""),
  });
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= field === "problems" && issue.code === "invalid_value" ? "Opção inválida." : issue.message;
    }
    return { ok: false, errors };
  }
  return { ok: true, data: { ...result.data, cpf: normalizeCpf(result.data.cpf) } };
}
