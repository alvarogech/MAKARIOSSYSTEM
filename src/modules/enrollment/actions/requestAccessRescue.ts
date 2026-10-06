"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { isValidCpf, normalizeCpf } from "@/services/cpf";
import { sendPasswordResetLink } from "@/modules/auth/passwordResetEmail";
import { checkRateLimit, getClientIp } from "@/modules/auth/rateLimit";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";
import { hashCpf } from "../dataProtection";
import { resendStudentOnboardingInvite } from "../studentReminders";

export type RescueOutcome =
  /** Link de primeiro acesso reenviado (convite ainda não usado). */
  | "invite_sent"
  /** A pessoa já criou a conta — enviado link para criar nova senha. */
  | "reset_sent"
  /** Inscrição ainda não aprovada. */
  | "in_review"
  /** Achou a inscrição, mas só a coordenação consegue resolver. */
  | "contact_coordination"
  /** E-mail não saiu (limite diário de envio ou falha) — tentar mais tarde. */
  | "email_failed";

export interface RequestAccessRescueState {
  error?: string;
  /** Preenchido só após uma busca válida. */
  result?: {
    found: boolean;
    outcomes: RescueOutcome[];
    /** Só quando a busca foi por CPF: ajuda quem digitou o e-mail errado a perceber o endereço usado. */
    maskedEmail?: string;
  };
}

const schema = z.object({
  identifier: z.string().trim().min(1, "Informe o e-mail ou o CPF usado na inscrição."),
});

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Autoatendimento de acesso, pensado para o link divulgado nos grupos de
 * WhatsApp: a pessoa informa o e-mail OU o CPF da inscrição e recebe o link
 * de acesso NO E-MAIL QUE JÁ ESTÁ NA INSCRIÇÃO — nunca em um endereço
 * digitado agora. Assim, quem só sabe o CPF/e-mail de outra pessoa não
 * consegue tomar a conta dela. Limitada por IP e por identificador.
 */
export async function requestAccessRescue(
  _prevState: RequestAccessRescueState,
  formData: FormData,
): Promise<RequestAccessRescueState> {
  const parsed = schema.safeParse({ identifier: formData.get("identifier") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const raw = parsed.data.identifier;
  const isEmail = raw.includes("@");
  const cpf = isEmail ? "" : normalizeCpf(raw);

  if (isEmail) {
    if (!z.string().email().safeParse(raw).success) {
      return { error: "E-mail inválido — confira se tem @ e o final (ex.: nome@gmail.com)." };
    }
  } else if (!isValidCpf(cpf)) {
    return { error: "CPF inválido — digite os 11 números, ou informe o e-mail da inscrição." };
  }

  const admin = createSupabaseAdminClient();
  const key = isEmail ? raw.toLowerCase() : cpf;

  const ip = await getClientIp();
  const okByIp = await checkRateLimit(admin, `access-rescue-ip:${ip}`, 15, 3600);
  const okByKey = await checkRateLimit(admin, `access-rescue-key:${key}`, 3, 3600);
  if (!okByIp || !okByKey) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const query = admin
    .from("enrollment_requests")
    .select("id, full_name, email, status, student_id")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: requests } = await (isEmail
    ? query.ilike("email", escapeIlike(raw))
    : query.eq("cpf_hash", hashCpf(cpf)));

  if (!requests || requests.length === 0) {
    return { result: { found: false, outcomes: [] } };
  }

  const outcomes = new Set<RescueOutcome>();

  for (const request of requests) {
    if (request.status === "pending") {
      outcomes.add("in_review");
      continue;
    }

    if (request.student_id) {
      // Já tem conta: o que falta é a senha. O link vai para o e-mail do perfil
      // (cadastro da conta) — contas por código de acesso não têm login por e-mail.
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name, email, status, access_code")
        .eq("id", request.student_id)
        .maybeSingle();
      if (!profile || profile.status !== "active" || !profile.email || profile.access_code) {
        outcomes.add("contact_coordination");
        continue;
      }
      try {
        await sendPasswordResetLink(admin, { id: profile.id, full_name: profile.full_name, email: profile.email });
        outcomes.add("reset_sent");
      } catch (error) {
        console.error("Falha ao enviar link de nova senha (resgate de acesso):", error);
        outcomes.add("email_failed");
      }
      continue;
    }

    const { data: invitation } = await admin
      .from("invitations")
      .select("id")
      .eq("enrollment_request_id", request.id)
      .eq("purpose", "student_onboarding")
      .eq("channel", "email")
      .is("consumed_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (!invitation) {
      outcomes.add("contact_coordination");
      continue;
    }

    // Reenvia o MESMO link de sempre (estável) e renova a validade por 14 dias.
    const sent = await resendStudentOnboardingInvite(invitation.id);
    outcomes.add(sent.ok ? "invite_sent" : "email_failed");
  }

  const emailSent = outcomes.has("invite_sent") || outcomes.has("reset_sent");
  const maskedEmail = !isEmail && emailSent ? maskEmail(requests[0]?.email ?? "") : undefined;

  return { result: { found: true, outcomes: [...outcomes], maskedEmail } };
}
