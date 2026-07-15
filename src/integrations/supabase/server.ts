import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { getPublicEnv } from "@/lib/env";

/**
 * Client Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Usa a publishable key (não a secret key) e propaga a sessão do
 * usuário via cookies — toda leitura/escrita continua sujeita a RLS.
 *
 * Este client NÃO tem privilégio administrativo. Para operações que
 * realmente exigem bypass de RLS, use `createSupabaseAdminClient` em
 * `@/integrations/supabase/admin`, e apenas depois de a camada de
 * autorização já ter validado a operação.
 */
export async function createSupabaseServerClient() {
  // `cookies()` primeiro, de propósito: é a chamada que sinaliza ao Next.js
  // que esta rota é dinâmica (nunca deve ser pré-renderizada em build). Se
  // a validação de env rodasse antes e lançasse, o Next nunca chegaria a
  // ver essa chamada e trataria o erro como falha de prerender em vez de
  // simplesmente pular a geração estática da rota.
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` foi chamado a partir de um Server Component (sem
            // acesso de escrita a cookies). Isso é esperado quando o
            // middleware já cuida de renovar a sessão a cada requisição —
            // pode ser ignorado com segurança neste caso.
          }
        },
      },
    },
  );
}
