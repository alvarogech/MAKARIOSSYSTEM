import "server-only";

import nodemailer from "nodemailer";
import { getSmtpEnv } from "@/lib/serverEnv";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const env = getSmtpEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Único ponto de envio de e-mail da aplicação (fora dos e-mails de
 * autenticação do próprio Supabase, como "Esqueci minha senha" do fluxo
 * legado). Usado para o primeiro acesso de aluno — nunca para o professor,
 * que usa link manual por WhatsApp.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  const env = getSmtpEnv();
  const transport = getTransporter();

  await transport.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    replyTo: env.SMTP_REPLY_TO,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
