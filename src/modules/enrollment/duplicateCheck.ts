// Regra de inscrição única: um e-mail e um CPF por pessoa, entre as inscrições vivas do semestre.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";

export type EnrollmentConflict = "cpf" | "email" | null;

export const DUPLICATE_CPF_MESSAGE =
  "Já existe uma inscrição com este CPF neste semestre. Se precisar corrigir alguma informação, fale com a coordenação da Escola Makários.";

export const DUPLICATE_EMAIL_MESSAGE =
  "Este e-mail já foi usado em outra inscrição. Cada pessoa precisa de um e-mail só dela (marido e esposa, pais e filhos: cada um com o seu). " +
  "Se a inscrição já é sua, não precisa enviar de novo: fale com a coordenação da Escola Makários.";

export interface DuplicateCandidate {
  seasonId: string;
  email: string;
  /** Só na inscrição pública: a edição não troca o CPF. */
  cpfHash?: string;
  /** Na edição, a própria inscrição não conta como repetida. */
  excludeId?: string;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Na edição pela coordenação: só é troca de e-mail se mudar além de maiúsculas e espaços. */
export function isEmailChange(nextEmail: string, currentEmail: string): boolean {
  return normalizeEmail(nextEmail) !== normalizeEmail(currentEmail);
}

/** Só inscrição pendente ou aprovada conta; recusada e cancelada liberam o dado. */
export const LIVE_STATUSES = ["pending", "approved"] as const;

/** Devolve qual dado já está em outra inscrição viva do semestre (CPF tem prioridade). */
export async function findEnrollmentConflict(
  admin: SupabaseClient<Database>,
  candidate: DuplicateCandidate,
): Promise<EnrollmentConflict> {
  if (candidate.cpfHash) {
    let query = admin
      .from("enrollment_requests")
      .select("id")
      .eq("season_id", candidate.seasonId)
      .in("status", [...LIVE_STATUSES])
      .eq("cpf_hash", candidate.cpfHash)
      .limit(1);
    if (candidate.excludeId) query = query.neq("id", candidate.excludeId);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) return "cpf";
  }

  const email = normalizeEmail(candidate.email);
  let emailQuery = admin
    .from("enrollment_requests")
    .select("id, email")
    .eq("season_id", candidate.seasonId)
    .in("status", [...LIVE_STATUSES])
    .ilike("email", `%${escapeIlike(email)}%`)
    .limit(50);
  if (candidate.excludeId) emailQuery = emailQuery.neq("id", candidate.excludeId);
  const { data: rows, error: emailError } = await emailQuery;
  if (emailError) throw emailError;
  // O ilike com curinga acha parecidos; a igualdade exata (sem espaços e maiúsculas) é conferida aqui.
  if ((rows ?? []).some((row) => normalizeEmail(row.email) === email)) return "email";

  return null;
}
