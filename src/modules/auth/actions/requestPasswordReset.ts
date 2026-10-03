"use server";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getPublicEnv } from "@/lib/env";
import { sendMail } from "@/modules/notifications/mailer";
import { generateInviteToken, hashInviteToken } from "../inviteTokens";
import { checkRateLimit, getClientIp } from "../rateLimit";
import { escapeIlike } from "../lookupTeacherCandidate";
import { requestPasswordResetSchema } from "../schemas";

// Mesmo link de uso único da recuperação assistida (24h). O link do Supabase
// Auth vencia em 1h, só abria no mesmo navegador em que foi pedido e era
// "gasto" por antivírus/leitores de e-mail — muita gente via "link expirado".
const RESET_TTL_HOURS = 24;

export interface RequestPasswordResetState {
  error?: string;
  success?: boolean;
}

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createSupabaseAdminClient();
  const email = parsed.data.email.trim();

  const ip = await getClientIp();
  const okByIp = await checkRateLimit(admin, `request-reset-ip:${ip}`, 10, 3600);
  const okByEmail = await checkRateLimit(admin, `request-reset-email:${email.toLowerCase()}`, 3, 3600);

  // Sempre responde com sucesso, mesmo se o e-mail não existir ou o limite
  // estourar — evita que a tela seja usada para descobrir quais e-mails têm conta.
  if (!okByIp || !okByEmail) return { success: true };

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email, status")
    .ilike("email", escapeIlike(email));

  // Mais de um perfil com o mesmo e-mail (ex.: administrador que também é
  // aluno) não dá para resolver sozinho — a coordenação gera o link assistido.
  const profile = profiles?.length === 1 ? profiles[0] : null;
  if (!profile || profile.status !== "active" || !profile.email) {
    return { success: true };
  }

  const { data: role } = await admin.from("roles").select("id").eq("slug", "student").single();
  if (!role) return { success: true };

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
  if (insertError) return { success: true };

  const link = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/redefinir-senha-assistida/${rawToken}`;
  const firstName = profile.full_name.split(" ")[0];

  try {
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
  } catch {
    // Silencioso de propósito (ver comentário acima); cota diária do Resend
    // ou falha SMTP não podem revelar se o e-mail existe.
  }

  return { success: true };
}
