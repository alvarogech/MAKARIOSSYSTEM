import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getPublicEnv } from "@/lib/env";
import { sendMail } from "@/modules/notifications/mailer";
import { generateInviteToken, hashInviteToken } from "./inviteTokens";

// Mesmo link de uso único da recuperação assistida (24h). O link do Supabase
// Auth vencia em 1h, só abria no mesmo navegador em que foi pedido e era
// "gasto" por antivírus/leitores de e-mail — muita gente via "link expirado".
export const RESET_TTL_HOURS = 24;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Gera o link de nova senha para uma conta (identificada pelo perfil — nunca
 * pelo e-mail, que pode ser compartilhado) e envia para o e-mail dela.
 * Lança erro se o envio falhar; quem chama decide o que mostrar.
 */
export async function sendPasswordResetLink(
  admin: SupabaseClient<Database>,
  profile: { id: string; full_name: string; email: string },
): Promise<void> {
  const { data: role } = await admin.from("roles").select("id").eq("slug", "student").single();
  if (!role) throw new Error("Papel 'student' não encontrado.");

  const rawToken = generateInviteToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);

  const { error: insertError } = await admin.from("invitations").insert({
    email: profile.email,
    // NOT NULL na tabela, irrelevante aqui (a conta já existe).
    intended_role_id: role.id,
    // NOT NULL: o próprio titular da conta é quem pede a redefinição.
    invited_by: profile.id,
    channel: "manual_link",
    purpose: "password_reset",
    intended_full_name: profile.full_name,
    token_hash: hashInviteToken(rawToken),
    token_expires_at: expiresAt.toISOString(),
  });
  if (insertError) throw new Error("Não foi possível gerar o link de redefinição.");

  const link = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/redefinir-senha-assistida/${rawToken}`;
  const firstName = escapeHtml(profile.full_name.split(" ")[0] ?? "");

  await sendMail({
    to: profile.email,
    subject: "Redefinir sua senha — Escola Makários",
    text:
      `Olá, ${firstName}! Use o link abaixo para criar uma nova senha ` +
      `(vale por ${RESET_TTL_HOURS} horas, uso único):\n${link}\n\n` +
      `Se você não pediu isso, ignore este e-mail.`,
    html:
      `<p>Olá, ${firstName}!</p>` +
      `<p>Use o botão abaixo para criar uma nova senha. O link vale por ${RESET_TTL_HOURS} horas e só pode ser usado uma vez.</p>` +
      `<p><a href="${link}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Criar nova senha</a></p>` +
      `<p style="font-size:12px;color:#666">Se o botão não abrir, copie este endereço no navegador:<br>${link}</p>` +
      `<p style="font-size:12px;color:#666">Se você não pediu isso, ignore este e-mail.</p>`,
  });
}
