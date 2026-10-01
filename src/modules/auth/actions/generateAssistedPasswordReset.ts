"use server";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { getPublicEnv } from "@/lib/env";
import { generateInviteToken, hashInviteToken } from "../inviteTokens";

// 24h: curto o bastante para um link de troca de senha, mas dá tempo real
// de alguém abrir o WhatsApp sem o coordenador ter que ficar regenerando.
const RESET_TTL_HOURS = 24;

export interface GenerateAssistedPasswordResetState {
  error?: string;
  result?: { link: string; whatsappMessage: string };
}

/**
 * "Recuperação assistida": coordenação já confirmou a identidade do
 * professor pelo canal habitual (seção 3) e gera um link de troca de senha
 * de validade curta para enviar manualmente. Nunca atribui papel, nunca
 * mexe em turma, e se recusa a gerar para conta suspensa (reativar uma
 * conta suspensa é decisão separada, não um efeito colateral de "esqueci a
 * senha").
 */
export async function generateAssistedPasswordReset(
  _prevState: GenerateAssistedPasswordResetState,
  formData: FormData,
): Promise<GenerateAssistedPasswordResetState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "teacher_provisioning", action: "manage" })
  ) {
    return { error: "Você não tem permissão para gerar recuperação assistida." };
  }

  const targetUserId = formData.get("userId");
  if (typeof targetUserId !== "string" || !targetUserId) {
    return { error: "Usuário inválido." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetProfile || !targetProfile.email) {
    return { error: "Usuário não encontrado." };
  }

  if (targetProfile.status !== "active") {
    return {
      error:
        "Esta conta está suspensa. Gerar um link de recuperação não reativa a conta " +
        "— reative-a primeiro (ação separada) antes de enviar um link de senha.",
    };
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);

  const { data: teacherRole } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", "teacher")
    .single();

  if (!teacherRole) {
    return { error: "Papel 'Professor' não encontrado no sistema." };
  }

  const { error } = await supabase.from("invitations").insert({
    email: targetProfile.email,
    // intended_role_id é NOT NULL na tabela, mas é irrelevante aqui: esta
    // linha nunca é vista pelo trigger handle_new_user (a conta já existe,
    // nenhum auth.users novo será criado) — só preenche a coluna.
    intended_role_id: teacherRole.id,
    invited_by: authContext.userId,
    channel: "manual_link",
    purpose: "password_reset",
    intended_full_name: targetProfile.full_name,
    token_hash: tokenHash,
    token_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return { error: "Não foi possível gerar o link de recuperação." };
  }

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const link = `${appUrl}/redefinir-senha-assistida/${rawToken}`;

  const whatsappMessage =
    `Olá, ${targetProfile.full_name}! Aqui está seu link para criar uma nova senha de acesso ` +
    `à Escola Makários. Ele vale por ${RESET_TTL_HOURS} horas e só pode ser usado uma vez: ${link}`;

  return { result: { link, whatsappMessage } };
}
