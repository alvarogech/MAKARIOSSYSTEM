"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getPublicEnv } from "@/lib/env";

/**
 * Client Supabase para uso no navegador (Client Components).
 *
 * Usa apenas a URL pública e a publishable key — respeita RLS via a sessão
 * do usuário autenticado. Nunca importe o client administrativo aqui.
 */
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
