import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

/**
 * Destino dos links enviados pelo Supabase Auth (convite, primeiro acesso,
 * recuperação de senha). Troca o `code` da URL por uma sessão válida e
 * redireciona para o próximo passo (`next`, default: primeiro acesso).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/primeiro-acesso";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
