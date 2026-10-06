"use server";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { sendPasswordResetLink } from "../passwordResetEmail";
import { checkRateLimit, getClientIp } from "../rateLimit";
import { escapeIlike } from "../lookupTeacherCandidate";
import { requestPasswordResetSchema } from "../schemas";

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

  // Mais de um perfil com o mesmo e-mail (ex.: irmãos com o e-mail do
  // responsável) não dá para resolver sozinho — a coordenação gera o link assistido.
  const profile = profiles?.length === 1 ? profiles[0] : null;
  if (!profile || profile.status !== "active" || !profile.email) {
    return { success: true };
  }

  try {
    await sendPasswordResetLink(admin, { id: profile.id, full_name: profile.full_name, email: profile.email });
  } catch {
    // Silencioso de propósito (ver comentário acima); cota diária do provedor
    // de e-mail ou falha SMTP não podem revelar se o e-mail existe.
  }

  return { success: true };
}
