import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/integrations/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em toda rota, exceto assets estáticos e arquivos internos do
     * Next.js — evita custo desnecessário em requisições que não precisam
     * de sessão.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
