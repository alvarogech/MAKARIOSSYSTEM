import { z } from "zod";

/**
 * Variáveis expostas ao navegador. Qualquer coisa aqui acaba no bundle
 * client-side — por isso este schema nunca deve conter segredos.
 *
 * Este arquivo é seguro para ser importado por Client Components (ex.:
 * `@/integrations/supabase/client`). Variáveis exclusivamente server-side
 * vivem em `@/lib/serverEnv`, guardado por `import "server-only"` — nunca
 * junte as duas coisas neste arquivo de novo. Um `serverEnvSchema` já
 * viveu aqui sem esse guard e vazou o nome de `SUPABASE_SECRET_KEY` para
 * um bundle client-side assim que o primeiro Client Component passou a
 * importar `getPublicEnv` (ver histórico do dashboard de inscrições) —
 * corrigido separando os dois.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente públicas inválidas ou ausentes: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
