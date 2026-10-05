"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";
import { resendStudentOnboardingInvite } from "../studentReminders";

export interface RequestStudentInviteLinkState {
  error?: string;
  success?: boolean;
}

const schema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
});

/**
 * Autoatendimento para "link inválido/expirado": a pessoa informa o e-mail
 * da inscrição e recebe o link de acesso de novo, no próprio e-mail do
 * convite (nunca em outro endereço). Sempre responde igual, exista ou não
 * um convite pendente — a tela não serve para descobrir e-mails inscritos.
 */
export async function requestStudentInviteLink(
  _prevState: RequestStudentInviteLinkState,
  formData: FormData,
): Promise<RequestStudentInviteLinkState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createSupabaseAdminClient();
  const email = parsed.data.email.toLowerCase();

  const ip = await getClientIp();
  const okByIp = await checkRateLimit(admin, `student-link-ip:${ip}`, 10, 3600);
  const okByEmail = await checkRateLimit(admin, `student-link-email:${email}`, 3, 3600);
  if (!okByIp || !okByEmail) return { success: true };

  const { data: invites } = await admin
    .from("invitations")
    .select("id")
    .eq("channel", "email")
    .eq("purpose", "student_onboarding")
    .ilike("email", escapeIlike(email))
    .is("consumed_at", null)
    .is("revoked_at", null)
    .limit(3);

  for (const invite of invites ?? []) {
    await resendStudentOnboardingInvite(invite.id);
  }

  return { success: true };
}
