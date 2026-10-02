import "server-only";

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Sem 0/O, 1/I/L — todo caractere ambíguo de propósito, já que a pessoa
// vai precisar digitar isto de novo em todo login futuro.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `MKS-${code}`;
}

/**
 * Código de acesso único por aluno — a identidade de login dele
 * (auth.users.phone), no lugar do e-mail (que pode ser compartilhado
 * entre familiares). Gerado uma vez, no primeiro acesso; a colisão é
 * praticamente impossível (32^6 combinações), mas confere mesmo assim.
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
