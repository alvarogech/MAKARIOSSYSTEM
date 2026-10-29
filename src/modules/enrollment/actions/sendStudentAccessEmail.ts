"use server";

import { z } from "zod";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";
import { resendStudentOnboardingInvite } from "../studentReminders";

export type SendAccessEmailResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Reenvia por e-mail o link de primeiro acesso do aluno aprovado sem conta,
 * a partir da ficha. É o MESMO link do botão do WhatsApp (token derivado do
 * id do convite), então os dois caminhos valem juntos.
 *
 * Vai sempre para o e-mail que está na ficha: se a coordenação trocou o
 * e-mail da inscrição, o convite é alinhado antes do envio. O lembrete
 * automático não cobre esse caso, porque para de mandar depois que a turma
 * começa.
 */
export async function sendStudentAccessEmail(requestId: string): Promise<SendAccessEmailResult> {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) {
    return { ok: false, error: "Só a coordenação pode reenviar o acesso." };
  }
  if (!z.string().uuid().safeParse(requestId).success) {
    return { ok: false, error: "Inscrição inválida." };
  }

  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from("enrollment_requests")
    .select("id, email, status, student_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Inscrição não encontrada." };
  if (request.status !== "approved") return { ok: false, error: "A inscrição ainda não foi aprovada." };
  if (request.student_id) {
    return { ok: false, error: "Este aluno já criou a conta. Oriente a entrar pelo login ou usar \"Esqueci minha senha\"." };
  }

  const email = request.email.trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { ok: false, error: "O e-mail da ficha está inválido. Corrija em \"Editar inscrição\"." };
  }

  // Mesma busca do botão do WhatsApp: o convite ligado à inscrição e, nos
  // mais antigos, o convite só pelo e-mail.
  const pending = () =>
    admin
      .from("invitations")
      .select("id, email")
      .eq("purpose", "student_onboarding")
      .eq("channel", "email")
      .is("consumed_at", null)
      .is("revoked_at", null)
      .order("invited_at", { ascending: false })
      .limit(1);
  const { data: byRequest } = await pending().eq("enrollment_request_id", request.id);
  let invite = byRequest?.[0] ?? null;
  if (!invite) {
    const { data: byEmail } = await pending().ilike("email", escapeIlike(email));
    invite = byEmail?.[0] ?? null;
  }
  if (!invite) {
    return { ok: false, error: "Não há convite pendente para esta inscrição. Peça ao administrador para gerar o convite de novo." };
  }

  if (invite.email.trim().toLowerCase() !== email) {
    const { error: syncError } = await admin.from("invitations").update({ email }).eq("id", invite.id);
    if (syncError) return { ok: false, error: "Não foi possível atualizar o e-mail do convite. Tente de novo." };
  }

  const result = await resendStudentOnboardingInvite(invite.id);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, email };
}
