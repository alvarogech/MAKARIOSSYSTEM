"use server";

import { z } from "zod";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getPublicEnv } from "@/lib/env";
import { deriveStudentInviteToken, hashInviteToken } from "@/modules/auth/inviteTokens";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";
import { isValidBrazilianPhone } from "@/services/phone";
import { buildWhatsAppLink } from "@/services/whatsapp";

export type ShareAccessLinkResult =
  | { ok: true; link: string; whatsappUrl: string | null }
  | { ok: false; error: string };

const LINK_TTL_DAYS = 14;

/**
 * Link de primeiro acesso do aluno para a coordenação mandar pelo WhatsApp,
 * quando o e-mail do convite não chega (iCloud e Hotmail costumam jogar no
 * lixo eletrônico). É o MESMO link do e-mail (token derivado do id do convite),
 * só com a validade renovada; nenhum e-mail é enviado aqui.
 */
export async function shareStudentAccessLink(requestId: string): Promise<ShareAccessLinkResult> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) {
    return { ok: false, error: "Só a coordenação pode gerar o link de acesso." };
  }
  if (!z.string().uuid().safeParse(requestId).success) {
    return { ok: false, error: "Inscrição inválida." };
  }

  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from("enrollment_requests")
    .select("id, full_name, email, phone, status, student_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Inscrição não encontrada." };
  if (request.status !== "approved") return { ok: false, error: "A inscrição ainda não foi aprovada." };
  if (request.student_id) {
    return { ok: false, error: "Este aluno já criou a conta. Oriente a entrar pelo login ou usar \"Esqueci minha senha\"." };
  }

  const pending = () =>
    admin
      .from("invitations")
      .select("id")
      .eq("purpose", "student_onboarding")
      .eq("channel", "email")
      .is("consumed_at", null)
      .is("revoked_at", null)
      .order("invited_at", { ascending: false })
      .limit(1);
  // O convite nasce ligado à inscrição; os mais antigos podem só ter o e-mail.
  const { data: byRequest } = await pending().eq("enrollment_request_id", request.id);
  let invite = byRequest?.[0] ?? null;
  if (!invite) {
    const { data: byEmail } = await pending().ilike("email", escapeIlike(request.email));
    invite = byEmail?.[0] ?? null;
  }
  if (!invite) {
    return { ok: false, error: "Não há convite pendente para esta inscrição. Peça ao administrador para gerar o convite de novo." };
  }

  const rawToken = deriveStudentInviteToken(invite.id);
  const { error: renewError } = await admin
    .from("invitations")
    .update({
      token_hash: hashInviteToken(rawToken),
      token_expires_at: new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", invite.id);
  if (renewError) return { ok: false, error: "Não foi possível gerar o link agora. Tente de novo." };

  const link = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/convite-aluno/${rawToken}`;
  const firstName = request.full_name.trim().split(/\s+/)[0] ?? "";
  const message =
    `Olá, ${firstName}! Aqui é da coordenação da Escola Makários. ` +
    `Este é o seu link para criar a sua conta na plataforma (vale por ${LINK_TTL_DAYS} dias): ${link}`;
  const whatsappUrl = isValidBrazilianPhone(request.phone)
    ? `${buildWhatsAppLink(request.phone)}?text=${encodeURIComponent(message)}`
    : null;

  return { ok: true, link, whatsappUrl };
}
