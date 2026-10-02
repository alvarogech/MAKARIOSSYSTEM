import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getPublicEnv } from "@/lib/env";
import { formatSaoPauloLongDate } from "@/lib/saoPauloDate";
import { generateInviteToken, hashInviteToken } from "@/modules/auth/inviteTokens";
import { sendMail } from "@/modules/notifications/mailer";

const FIRST_REMINDER_AFTER_DAYS = 3;
const FINAL_REMINDER_WITHIN_DAYS = 2;
// Teto de envios reais (SMTP) por chamada — sem isso, um dia com muitos
// convites vencendo ao mesmo tempo (ex.: logo depois de uma aprovação em
// lote) faz a função estourar o tempo limite da function antes de
// terminar (confirmado ao vivo: 195 convites pendentes, timeout 504).
// Sobra sempre fica pro próximo disparo do cron, sem duplicar nada,
// porque reminder_stage só avança depois do envio dar certo.
const MAX_SENDS_PER_RUN = 15;

interface PendingInvite {
  id: string;
  email: string;
  intended_full_name: string | null;
  invited_at: string;
  reminder_stage: string;
  class_ids: string[] | null;
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

async function firstMeetingDateForClasses(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  classIds: string[],
): Promise<string | null> {
  if (classIds.length === 0) return null;
  const { data } = await admin
    .from("class_meetings")
    .select("meeting_date")
    .in("class_id", classIds)
    .order("meeting_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data?.meeting_date ?? null;
}

function buildReminderEmail(
  fullName: string,
  link: string,
  isFinal: boolean,
  firstMeetingDate: string | null,
) {
  const subject = isFinal
    ? "Sua turma na Escola Makários começa em breve — falta só acessar a plataforma"
    : "Ainda dá tempo: acesse a plataforma da Escola Makários";
  const dateLabel = firstMeetingDate ? formatSaoPauloLongDate(firstMeetingDate, { capitalize: true }) : null;
  const intro = isFinal
    ? `Sua primeira aula é ${dateLabel ?? "em breve"} e vimos que você ainda não acessou a plataforma.`
    : "Notamos que você ainda não acessou a plataforma da Escola Makários.";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
      <p>Olá, ${fullName}!</p>
      <p>${intro} É lá que ficam o calendário, os materiais de aula e suas atividades.</p>
      <p style="margin:20px 0;">
        <a href="${link}" style="background:#2e7fbf;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Acessar a plataforma
        </a>
      </p>
      <p style="font-size:13px;color:#666;">Ou copie e cole este endereço no navegador: ${link}</p>
      <p>Qualquer dúvida, é só nos procurar.</p>
      <p>Escola Makários — Igreja Emaús</p>
    </div>`;

  const text =
    `Olá, ${fullName}!\n\n${intro}\n\n` +
    `Acesse a plataforma: ${link}\n\nQualquer dúvida, é só nos procurar.\nEscola Makários — Igreja Emaús`;

  return { subject, html, text };
}

/**
 * Lembrete de primeiro acesso para aluno: 1 vez perto de 3 dias depois do
 * convite, 1 vez final perto da primeira aula — nunca diário (ver decisão
 * tomada com a coordenação). Idempotente: cada convite só avança de estágio
 * uma vez (reminder_stage), então rodar isto várias vezes no mesmo dia não
 * duplica envio. Chamado pela rota /api/cron/student-reminders.
 */
interface DueReminder {
  invite: PendingInvite & { token_hash: string };
  isFinal: boolean;
  firstMeetingDate: string | null;
  daysUntilClass: number | null;
  daysSinceInvited: number;
}

export async function sendDueStudentOnboardingReminders(): Promise<{ sent: number; failed: number }> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  const { data: invites } = await admin
    .from("invitations")
    .select("id, email, intended_full_name, invited_at, reminder_stage, class_ids, token_hash")
    .eq("channel", "email")
    .eq("purpose", "student_onboarding")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("token_expires_at", now.toISOString())
    .neq("reminder_stage", "final_sent");

  // Primeiro só calcula quem está devendo lembrete (leituras baratas no
  // banco) — o envio de e-mail em si, bem mais lento, só acontece depois,
  // já limitado a MAX_SENDS_PER_RUN.
  const due: DueReminder[] = [];
  for (const invite of (invites ?? []) as (PendingInvite & { token_hash: string })[]) {
    const daysSinceInvited = daysBetween(now, new Date(invite.invited_at));
    const firstMeetingDate = await firstMeetingDateForClasses(admin, invite.class_ids ?? []);
    const daysUntilClass = firstMeetingDate
      ? daysBetween(new Date(`${firstMeetingDate}T00:00:00-03:00`), now)
      : null;

    const classAlreadyStarted = daysUntilClass !== null && daysUntilClass < 0;
    if (classAlreadyStarted) continue; // não insiste depois que a aula já começou

    let shouldSendFinal = false;
    let shouldSendFirst = false;

    if (invite.reminder_stage === "first_sent") {
      shouldSendFinal = daysUntilClass !== null && daysUntilClass <= FINAL_REMINDER_WITHIN_DAYS;
    } else if (invite.reminder_stage === "none") {
      const classStartsSoon = daysUntilClass !== null && daysUntilClass <= FINAL_REMINDER_WITHIN_DAYS;
      if (classStartsSoon) {
        // Convite recente mas a aula já tá em cima — pula direto pro
        // lembrete final em vez de mandar os dois quase juntos.
        shouldSendFinal = true;
      } else {
        shouldSendFirst = daysSinceInvited >= FIRST_REMINDER_AFTER_DAYS;
      }
    }

    if (!shouldSendFirst && !shouldSendFinal) continue;
    due.push({ invite, isFinal: shouldSendFinal, firstMeetingDate, daysUntilClass, daysSinceInvited });
  }

  // Prioriza quem está mais perto da própria aula (lembrete final, do mais
  // urgente pro menos) e só depois os lembretes "ainda dá tempo" (do mais
  // atrasado pro mais recente) — se sobrar mais devendo do que o teto por
  // chamada, quem mais precisa é atendido primeiro; o resto fica pro
  // próximo disparo do cron.
  due.sort((a, b) => {
    if (a.isFinal !== b.isFinal) return a.isFinal ? -1 : 1;
    if (a.isFinal) return (a.daysUntilClass ?? Infinity) - (b.daysUntilClass ?? Infinity);
    return b.daysSinceInvited - a.daysSinceInvited;
  });

  let sent = 0;
  let failed = 0;

  for (const { invite, isFinal, firstMeetingDate } of due.slice(0, MAX_SENDS_PER_RUN)) {
    // O token bruto nunca é persistido (só o hash) — então um lembrete não
    // pode reusar o link original. Em vez disso, troca para um novo token
    // de MESMA validade/estado (não reseta expiração nem conta de
    // tentativa), só pra ter algo a colocar no e-mail.
    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);

    const { error: rotateError } = await admin
      .from("invitations")
      .update({ token_hash: tokenHash })
      .eq("id", invite.id)
      .eq("token_hash", invite.token_hash);
    if (rotateError) {
      failed += 1;
      continue;
    }

    const link = `${appUrl}/convite-aluno/${rawToken}`;
    const { subject, html, text } = buildReminderEmail(
      invite.intended_full_name ?? "aluno(a)",
      link,
      isFinal,
      firstMeetingDate,
    );

    try {
      await sendMail({ to: invite.email, subject, html, text });
      await admin
        .from("invitations")
        .update({
          reminder_stage: isFinal ? "final_sent" : "first_sent",
          last_sent_at: now.toISOString(),
        })
        .eq("id", invite.id);
      sent += 1;
    } catch (error) {
      console.error("Falha ao enviar lembrete de primeiro acesso do aluno:", error);
      failed += 1;
    }
  }

  return { sent, failed };
}

/**
 * Força o reenvio do convite de UM aluno específico, fora do ciclo normal
 * do cron — para o caso (real, já aconteceu) de o link original não
 * funcionar por algum motivo alheio ao sistema (ex.: o cliente de e-mail
 * do aluno corrompeu o link). Reaproveita a mesma troca de token do
 * lembrete; manda como "final" sempre que a aula já está próxima, senão
 * como lembrete comum.
 */
export async function resendStudentOnboardingInvite(
  invitationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  const { data: invite, error: fetchError } = await admin
    .from("invitations")
    .select("id, email, intended_full_name, invited_at, reminder_stage, class_ids, token_hash, consumed_at, revoked_at")
    .eq("id", invitationId)
    .eq("channel", "email")
    .eq("purpose", "student_onboarding")
    .maybeSingle();

  if (fetchError || !invite) {
    return { ok: false, error: "Convite não encontrado." };
  }
  if (invite.consumed_at) {
    return { ok: false, error: "Este convite já foi usado — o aluno já tem conta, oriente a fazer login." };
  }
  if (invite.revoked_at) {
    return { ok: false, error: "Este convite foi revogado." };
  }

  const firstMeetingDate = await firstMeetingDateForClasses(admin, invite.class_ids ?? []);
  const daysUntilClass = firstMeetingDate
    ? daysBetween(new Date(`${firstMeetingDate}T00:00:00-03:00`), now)
    : null;
  const isFinal = daysUntilClass !== null && daysUntilClass <= FINAL_REMINDER_WITHIN_DAYS;

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);

  const { error: rotateError } = await admin
    .from("invitations")
    .update({ token_hash: tokenHash, token_expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", invite.id)
    .eq("token_hash", invite.token_hash ?? "");
  if (rotateError) {
    return { ok: false, error: "Não foi possível gerar um novo link." };
  }

  const link = `${appUrl}/convite-aluno/${rawToken}`;
  const { subject, html, text } = buildReminderEmail(invite.intended_full_name ?? "aluno(a)", link, isFinal, firstMeetingDate);

  try {
    await sendMail({ to: invite.email, subject, html, text });
  } catch (error) {
    console.error("Falha ao reenviar convite manualmente:", error);
    return { ok: false, error: "Link gerado, mas o e-mail não pôde ser enviado." };
  }

  await admin
    .from("invitations")
    .update({ reminder_stage: isFinal ? "final_sent" : invite.reminder_stage, last_sent_at: now.toISOString() })
    .eq("id", invite.id);

  return { ok: true };
}
