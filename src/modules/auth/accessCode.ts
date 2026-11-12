import "server-only";

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Guardado em auth.users.phone, que o GoTrue valida como E.164 (só
// dígitos, sem "+", começando com 1-9) — por isso o código é inteiramente
// numérico, não alfanumérico. "999" é um prefixo que nenhum país usa como
// código de discagem internacional, então o valor nunca pode ser
// confundido com um telefone real; ele nunca é discado nem recebe SMS,
// serve só como identificador técnico de login.
const PREFIX = "999";
const RANDOM_DIGITS = 6;

function randomCode(): string {
  let digits = "";
  for (let i = 0; i < RANDOM_DIGITS; i++) {
    digits += randomInt(10).toString();
  }
  return `${PREFIX}${digits}`;
}

/**
 * Código de acesso único por aluno — a identidade de login dele
 * (auth.users.phone), no lugar do e-mail (que pode ser compartilhado
 * entre familiares). Gerado uma vez, no primeiro acesso; a colisão é
 * praticamente impossível (10^6 combinações), mas confere mesmo assim.
 */
export async function generateUniqueAccessCode(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomCode();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("access_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Não foi possível gerar um código de acesso único.");
}

/** Formata o código bruto ("999123456") para exibição ("999-123-456"). */
export function formatAccessCode(code: string): string {
  return code.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1-$2-$3");
}

/** Remove tudo que não é dígito — para aceitar o código com ou sem "-". */
export function normalizeAccessCode(input: string): string {
  return input.replace(/\D/g, "");
}

/** Formato válido de um código de acesso já sem traço nem espaço. */
export function isAccessCode(value: string): boolean {
  return /^999\d{6}$/.test(value);
}

// Domínio reservado para teste e uso interno (RFC 2606): nenhum e-mail enviado para ele é entregue.
const LOGIN_EMAIL_DOMAIN = "makarios.invalid";

/**
 * E-mail técnico de login da conta por código. O Supabase só aceita login por
 * telefone com o provedor Phone ligado no projeto, e ele fica desligado; por
 * isso a conta por código também ganha este e-mail, usado só para entrar.
 * Não é o e-mail de contato do aluno (esse fica em profiles.email).
 */
export function accessCodeLoginEmail(code: string): string {
  return `${normalizeAccessCode(code)}@${LOGIN_EMAIL_DOMAIN}`;
}
