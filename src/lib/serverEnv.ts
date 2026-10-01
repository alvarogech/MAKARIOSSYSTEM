import "server-only";

import { z } from "zod";

/**
 * Variáveis exclusivamente server-side. O `import "server-only"` acima faz
 * o build falhar caso qualquer Client Component (mesmo indiretamente)
 * importe algo deste arquivo — a mesma proteção que `@/integrations/
 * supabase/admin` já tinha. Fica num arquivo separado de `@/lib/env`
 * (que é seguro para o cliente) de propósito: um Client Component que
 * precise de `getPublicEnv` nunca deve arrastar este módulo junto.
 */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente server-side inválidas ou ausentes: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}

/**
 * Chave dedicada à proteção do CPF nas solicitações públicas. Mantida
 * separada do schema geral para que apenas esse fluxo a exija em runtime.
 * Gere com: `openssl rand -base64 32`.
 */
export function getEnrollmentDataKey(): string {
  const value = process.env.ENROLLMENT_DATA_KEY;
  if (!value) {
    throw new Error("Variável server-side ENROLLMENT_DATA_KEY ausente.");
  }
  return value;
}

/**
 * Segredo compartilhado que protege a rota de cron
 * (/api/cron/student-reminders) — sem sessão de usuário, então a única
 * defesa contra chamada externa é este header. Gere com:
 * `openssl rand -base64 32`.
 */
export function getCronSecret(): string {
  const value = process.env.CRON_SECRET;
  if (!value) {
    throw new Error("Variável server-side CRON_SECRET ausente.");
  }
  return value;
}

const smtpEnvSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM_NAME: z.string().min(1),
  SMTP_FROM_EMAIL: z.string().email(),
  SMTP_REPLY_TO: z.string().email().optional(),
});

export type SmtpEnv = z.infer<typeof smtpEnvSchema>;

/**
 * Only required by features that actually send e-mail (hoje: primeiro
 * acesso de aluno). Isolado do schema geral de propósito — nenhuma rota
 * que não manda e-mail deve falhar por essas variáveis estarem ausentes.
 */
export function getSmtpEnv(): SmtpEnv {
  const parsed = smtpEnvSchema.safeParse({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
    SMTP_REPLY_TO: process.env.SMTP_REPLY_TO || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      `Variáveis de SMTP inválidas ou ausentes (preencha no Netlify): ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
