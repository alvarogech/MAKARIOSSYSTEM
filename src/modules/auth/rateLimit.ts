import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * IP do cliente a partir do cabeçalho que a borda do Netlify preenche.
 * Nunca confiar em `Host`/origem para links (ver `getPublicEnv().NEXT_PUBLIC_APP_URL`
 * nos módulos que montam URL) — isto aqui é só para a chave do rate limit.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Checa e registra uma tentativa contra `public.check_rate_limit` (RPC
 * SECURITY DEFINER — ver migration 47). Usado nos endpoints públicos do
 * convite manual (consulta de token e tentativa de aceite) para dificultar
 * tentativa automatizada de adivinhar token. `fail-open` deliberado: se a
 * própria checagem de rate limit falhar (ex.: RPC indisponível), não
 * queremos que isso vire um novo jeito de negar acesso legítimo — a
 * segurança real do token está na sua entropia, isto é só uma camada extra.
 */
export async function checkRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    return true;
  }

  return data !== false;
}
