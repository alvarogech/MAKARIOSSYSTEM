import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Client Supabase ADMINISTRATIVO — usa a SECRET KEY e IGNORA Row Level
 * Security.
 *
 * Regras de uso, sem exceção:
 *  1. Só pode ser importado por código que roda exclusivamente no servidor
 *     (Server Actions, Route Handlers, Netlify Functions). O import de
 *     "server-only" no topo deste arquivo faz o build falhar caso ele seja
 *     puxado, direta ou indiretamente, por um Client Component.
 *  2. Só deve ser usado quando a operação realmente exige privilégio
 *     administrativo (ex.: convidar usuário via `auth.admin.inviteUserByEmail`,
 *     encerrar sessão de outro usuário) — nunca como atalho para "evitar
 *     escrever uma política de RLS".
 *  3. Toda chamada que usa este client deve, antes, ter passado pela camada
 *     de políticas tipada em `@/authorization` — o bypass de RLS não é
 *     substituto da checagem de autorização da aplicação.
 *  4. Nunca reexporte a instância retornada por uma rota de API pública, nem
 *     a serialize numa resposta.
 *
 * Este módulo também está listado em `eslint.config.mjs` sob
 * `no-restricted-imports`, para que qualquer import acidental a partir de um
 * caminho não explicitamente revisado gere um erro de lint.
 */
export function createSupabaseAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
