"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { acceptAssistedResetSchema } from "../schemas";
import { hashInviteToken } from "../inviteTokens";
import { checkRateLimit, getClientIp } from "../rateLimit";
import { escapeIlike } from "../lookupTeacherCandidate";

export interface AcceptAssistedResetState {
  error?: string;
}

/**
 * Consumo do link de recuperação assistida (seção 3). Deliberadamente NÃO
 * toca em papel, turma ou status da conta — só troca a senha de uma conta
 * que já existe. Reconfirma "não suspensa" no momento do uso (não só no
 * momento em que o link foi gerado), para não virar um jeito indireto de
 * reativar conta suspensa entre a geração e o uso do link.
 */
export async function acceptAssistedPasswordReset(
  _prevState: AcceptAssistedResetState,
  formData: FormData,
): Promise<AcceptAssistedResetState> {
  const parsed = acceptAssistedResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createSupabaseAdminClient();

  const ip = await getClientIp();
  const okToTry = await checkRateLimit(admin, `accept-assisted-reset:${ip}`, 10, 600);
  if (!okToTry) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  const { data: claimed, error: claimError } = await admin
    .from("invitations")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .eq("channel", "manual_link")
    .eq("purpose", "password_reset")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("token_expires_at", new Date().toISOString())
    .select("id, email")
    .maybeSingle();

  if (claimError) {
    return { error: "Não foi possível processar o pedido. Tente novamente." };
  }

  if (!claimed) {
    return {
      error:
        "Este link é inválido, já foi usado ou expirou. Peça um novo à coordenação.",
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, status")
    .ilike("email", escapeIlike(claimed.email))
    .maybeSingle();

  if (!profile) {
    return { error: "Conta não encontrada. Avise a coordenação." };
  }

  if (profile.status !== "active") {
    return {
      error:
        "Esta conta está suspensa. Um link de recuperação não reativa a conta — " +
        "fale com a coordenação.",
    };
  }

  // email_confirm também aqui: contas antigas criadas pelo convite por
  // e-mail (inviteUserByEmail) que nunca foram abertas ficam com
  // email_confirmed_at nulo — sem isso, o signInWithPassword logo abaixo
  // falharia com "Email not confirmed" mesmo com a senha certa.
  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    password: parsed.data.password,
    email_confirm: true,
  });

  if (updateError) {
    return { error: "Não foi possível definir a nova senha. Avise a coordenação." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: claimed.email,
    password: parsed.data.password,
  });

  if (signInError) {
    redirect("/login");
  }

  redirect("/dashboard");
}
