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
