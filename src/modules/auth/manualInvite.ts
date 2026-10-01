import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getPublicEnv } from "@/lib/env";
import { generateInviteToken, hashInviteToken } from "./inviteTokens";

const TEACHER_INVITE_TTL_DAYS = 7;

export function buildTeacherInviteWhatsappMessage(fullName: string, link: string): string {
  return (
    `Olá, ${fullName}! Seu acesso à Escola Makários está pronto. ` +
    `Abra o link abaixo para confirmar seus dados e criar sua senha. ` +
    `Depois, você poderá acompanhar suas turmas, horários e materiais de aula: ${link}`
  );
}

/**
 * Cria uma nova linha de convite manual (channel=manual_link) com um token
 * fresco e retorna o link pronto para copiar. Usado tanto na criação
 * original quanto em "gerar novo convite" (que primeiro revoga o anterior e
 * então chama isto de novo) — sempre uma linha NOVA, nunca reaproveita
 * token antigo, para que revogar o anterior realmente o invalide.
 */
export async function createManualTeacherInvitationRow(
  supabase: SupabaseClient<Database>,
  params: {
    email: string;
    fullName: string;
    phone: string;
    classIds: string[];
    invitedBy: string;
    teacherRoleId: string;
  },
): Promise<{ link: string; whatsappMessage: string } | { dbError: true }> {
  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + TEACHER_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("invitations").insert({
    email: params.email,
    intended_role_id: params.teacherRoleId,
    invited_by: params.invitedBy,
    channel: "manual_link",
    purpose: "teacher_onboarding",
    intended_full_name: params.fullName,
    phone: params.phone,
    class_ids: params.classIds,
    token_hash: tokenHash,
    token_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return { dbError: true };
  }

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const link = `${appUrl}/convite-professor/${rawToken}`;

  return { link, whatsappMessage: buildTeacherInviteWhatsappMessage(params.fullName, link) };
}
