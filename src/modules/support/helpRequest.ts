import { z } from "zod";
import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
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

/**
 * Pedido de ajuste feito pelo aluno já logado, dentro da plataforma: só o que
 * ele mesmo pode ter visto errado no próprio cadastro. Não pede CPF nem
 * WhatsApp (o servidor sabe quem é). Quando o problema é o volume ou a turma,
 * ele diz para onde quer ir, para a coordenação só aplicar a troca.
 */
export const ADJUSTMENT_PROBLEMS = HELP_PROBLEMS.filter((p) =>
  ["turma_errada", "dados_errados", "outro"].includes(p.code),
);

const ADJUSTMENT_CODES = ADJUSTMENT_PROBLEMS.map((p) => p.code) as [HelpProblemCode, ...HelpProblemCode[]];
const volumeSlugs = ENROLLMENT_VOLUMES.map((v) => v.slug) as [string, ...string[]];
const scheduleSlugs = ENROLLMENT_SCHEDULES.map((s) => s.slug) as [string, ...string[]];

const adjustmentSchema = z
  .object({
    problems: z.array(z.enum(ADJUSTMENT_CODES)).min(1, "Marque o que está errado."),
    wantedVolume: z.string().optional(),
    wantedSchedule: z.string().optional(),
    message: z
      .string()
      .trim()
      .max(2000, "A mensagem passou de 2.000 caracteres.")
      .transform((v) => (v === "" ? null : v)),
  })
  .superRefine((v, ctx) => {
    if (v.problems.includes("turma_errada")) {
      if (!v.wantedVolume || !volumeSlugs.includes(v.wantedVolume)) {
        ctx.addIssue({ code: "custom", path: ["wantedVolume"], message: "Escolha o volume em que você deveria estar." });
      }
      if (!v.wantedSchedule || !scheduleSlugs.includes(v.wantedSchedule)) {
        ctx.addIssue({ code: "custom", path: ["wantedSchedule"], message: "Escolha o horário em que você deveria estar." });
      }
    }
    if ((v.problems.includes("dados_errados") || v.problems.includes("outro")) && v.message === null) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Conte no espaço em branco o que precisa ser corrigido." });
    }
  });

export type StudentAdjustmentInput = {
  problems: HelpProblemCode[];
  wantedVolume: string | null;
  wantedSchedule: string | null;
  message: string | null;
};

export type AdjustmentParseResult =
  | { ok: true; data: StudentAdjustmentInput }
  | { ok: false; errors: Record<string, string> };

export function parseStudentAdjustment(raw: {
  problems: unknown[];
  wantedVolume: unknown;
  wantedSchedule: unknown;
  message: unknown;
}): AdjustmentParseResult {
  const result = adjustmentSchema.safeParse({
    problems: [...new Set(raw.problems.map(String))],
    wantedVolume: String(raw.wantedVolume ?? ""),
    wantedSchedule: String(raw.wantedSchedule ?? ""),
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
  const { problems, message } = result.data;
  const wantsMove = problems.includes("turma_errada");
  return {
    ok: true,
    data: {
      problems,
      wantedVolume: wantsMove ? (result.data.wantedVolume ?? null) : null,
      wantedSchedule: wantsMove ? (result.data.wantedSchedule ?? null) : null,
      message,
    },
  };
}
