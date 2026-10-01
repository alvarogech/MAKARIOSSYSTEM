import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ExistingAccount {
  userId: string;
  fullName: string;
  email: string;
  status: "active" | "suspended";
  isTeacher: boolean;
}

/**
 * Normalização de e-mail usada em toda a busca/criação de convite manual —
 * sempre a mesma função, para que "Joao@X.com" e " joao@x.com " resolvam
 * para a mesma conta (seção 4: nunca criar duplicata por diferença de
 * caixa/espaço).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Busca uma conta existente pelo e-mail normalizado. Usa o client da
 * própria sessão da coordenação (não o administrativo) — `profiles` já
 * libera SELECT de qualquer linha para coordenação/admin via RLS — e a
 * função `user_has_role` (SECURITY DEFINER, mas com checagem própria de
 * quem pode perguntar) para saber se já é professor sem precisar de
 * `user_roles:manage`.
 */
// Escapa os curingas do ILIKE (% e _) — um e-mail real pode conter "_" no
// local-part (ex.: "jo_ana@x.com"), que sem escapar casaria com qualquer
// caractere ali e produziria falso positivo na busca de duplicidade.
export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export async function findExistingAccountByEmail(
  supabase: SupabaseClient<Database>,
  email: string,
): Promise<ExistingAccount | null> {
  const normalized = normalizeEmail(email);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .not("email", "is", null)
    .ilike("email", escapeIlike(normalized))
    .maybeSingle();

  if (!profile || !profile.email) {
    return null;
  }

  const { data: isTeacher } = await supabase.rpc("user_has_role", {
    target_user: profile.id,
    check_role: "teacher",
  });

  return {
    userId: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    status: profile.status,
    isTeacher: isTeacher === true,
  };
}
