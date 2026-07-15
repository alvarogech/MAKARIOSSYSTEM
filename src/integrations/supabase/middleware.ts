import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { getPublicEnv } from "@/lib/env";

/**
 * Renova a sessão do Supabase Auth a cada requisição (padrão oficial de
 * integração com Next.js/SSR) e propaga os cookies atualizados.
 *
 * Chamado a partir de `middleware.ts` na raiz do projeto — não decide
 * autorização por si só, apenas garante que a sessão chegue "fresca" às
 * Server Actions/Route Handlers, que são quem de fato aplica as políticas.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Força a validação do token junto ao Supabase Auth (não confia apenas no
  // cookie local) — necessário para detectar sessões revogadas/expiradas.
  await supabase.auth.getUser();

  return response;
}
