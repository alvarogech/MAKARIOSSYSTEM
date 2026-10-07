import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendMail } from "@/modules/notifications/mailer";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Bloco de HTML/texto com o link do grupo — usado sozinho ou dentro do e-mail de "conta pronta". */
export function groupInviteBlock(volumeName: string, url: string) {
  return {
    html:
      `<p>Entre no <strong>grupo de WhatsApp do ${escapeHtml(volumeName)}</strong> — é por lá que a turma recebe avisos e se comunica:</p>` +
      `<p style="margin:20px 0;"><a href="${url}" style="background:#25d366;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Entrar no grupo</a></p>` +
      `<p style="font-size:13px;color:#666;">Ou copie e cole este endereço no navegador: ${url}</p>`,
    text: `Entre no grupo de WhatsApp do ${volumeName} (avisos e comunicação da turma): ${url}`,
  };
}

export interface GroupEmailTarget {
  studentId: string;
  volumeId: string;
  volumeName: string;
  inviteUrl: string;
  fullName: string;
  email: string;
}

/**
 * Envia o e-mail com o link do grupo e registra o envio. O registro só é
 * gravado depois do envio bem-sucedido; com a chave (aluno, volume), um
 * reenvio em lote nunca manda duas vezes para a mesma pessoa.
 */
export async function sendGroupEmail(admin: SupabaseClient<Database>, target: GroupEmailTarget): Promise<void> {
  const block = groupInviteBlock(target.volumeName, target.inviteUrl);
  const firstName = target.fullName.split(" ")[0] || "aluno(a)";

  await sendMail({
    to: target.email,
    subject: `Grupo de WhatsApp do ${target.volumeName} — Escola Makários`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">` +
      `<p>Olá, ${escapeHtml(firstName)}!</p>${block.html}` +
      `<p>Escola Makários — Igreja Emaús</p></div>`,
    text: `Olá, ${firstName}!\n\n${block.text}\n\nEscola Makários — Igreja Emaús`,
  });

  await admin
    .from("volume_whatsapp_group_emails")
    .upsert(
      { student_id: target.studentId, volume_id: target.volumeId, email: target.email, sent_at: new Date().toISOString() },
      { onConflict: "student_id,volume_id" },
    );
}
