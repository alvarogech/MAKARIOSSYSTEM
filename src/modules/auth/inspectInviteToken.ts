import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { hashInviteToken } from "./inviteTokens";

export type InviteTokenStatus =
  | "valid"
  | "not_found"
  | "revoked"
  | "consumed"
  | "expired"
  | "lookup_failed";

export interface InviteTokenInfo {
  status: InviteTokenStatus;
  invitationId?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  useAccessCode?: boolean;
}

/**
 * Leitura PURA (nunca escreve nada) do estado de um token de convite manual
 * — usada pelas páginas públicas para decidir o que mostrar no GET, sem
 * jamais consumir o convite. A ação de aceitar (Server Action, nunca GET)
 * refaz esta mesma checagem de forma atômica antes de gravar algo.
 */
export async function inspectInviteToken(
  rawToken: string,
  channel: "manual_link" | "email",
  purpose: "teacher_onboarding" | "password_reset" | "student_onboarding",
): Promise<InviteTokenInfo> {
  const admin = createSupabaseAdminClient();
  const tokenHash = hashInviteToken(rawToken);

  const { data, error } = await admin
    .from("invitations")
    .select("id, email, intended_full_name, phone, consumed_at, revoked_at, token_expires_at, use_access_code")
    .eq("token_hash", tokenHash)
    .eq("channel", channel)
    .eq("purpose", purpose)
    .maybeSingle();

  // Falha na consulta em si (ex.: instabilidade momentânea) é bem diferente
  // de "este token não existe" — tratar como not_found diria a um professor
  // com link válido que o convite é inválido. Nunca confundir os dois.
  if (error) {
    return { status: "lookup_failed" };
  }

  if (!data) {
    return { status: "not_found" };
  }
  if (data.revoked_at) {
    return { status: "revoked" };
  }
  if (data.consumed_at) {
    return { status: "consumed" };
  }
  if (!data.token_expires_at || new Date(data.token_expires_at).getTime() < Date.now()) {
    return { status: "expired" };
  }

  return {
    status: "valid",
    invitationId: data.id,
    email: data.email,
    fullName: data.intended_full_name ?? "",
    phone: data.phone ?? "",
    useAccessCode: data.use_access_code,
  };
}
