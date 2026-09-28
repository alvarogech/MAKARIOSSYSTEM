import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { parseEnrollmentFilters } from "@/modules/enrollment/filters";
import { getFilteredEnrollmentRequestIds } from "@/modules/enrollment/queries";

/**
 * Retorna só os ids das inscrições que atendem aos filtros ativos — usado
 * por "selecionar todos os resultados do filtro" na barra de ações em
 * lote. Nunca devolve nome/e-mail/telefone, só ids, e limita a quantidade
 * (ver `getFilteredEnrollmentRequestIds`) para nunca carregar a base
 * inteira no navegador.
 */
export async function GET(request: Request) {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return NextResponse.json({ error: "Você não tem permissão para esta ação." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseEnrollmentFilters((key) => url.searchParams.get(key));
  const supabase = await createSupabaseServerClient();
  const { ids, truncated } = await getFilteredEnrollmentRequestIds(supabase, filters);

  return NextResponse.json({ ids, truncated });
}
