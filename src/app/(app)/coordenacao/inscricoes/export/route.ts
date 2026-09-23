import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { buildEnrollmentCsvFilename, buildEnrollmentRequestsCsv } from "@/modules/enrollment/csv";
import { parseEnrollmentFilters } from "@/modules/enrollment/filters";
import { getAllFilteredEnrollmentRequests } from "@/modules/enrollment/queries";

/**
 * Exportação CSV das inscrições, respeitando os filtros ativos na tela
 * (mesmos parâmetros de busca da página). Protegida em duas camadas: a
 * checagem de autorização abaixo (nega antes de qualquer consulta) e a
 * RLS de `enrollment_requests` (o client usado aqui é o autenticado, não
 * o administrativo — se por algum bug esta checagem falhasse, a RLS ainda
 * bloquearia quem não é coordenação/admin).
 */
export async function GET(request: Request) {
  const authContext = await getAuthContext();

  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return NextResponse.json({ error: "Você não tem permissão para exportar inscrições." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseEnrollmentFilters((key) => url.searchParams.get(key));

  const supabase = await createSupabaseServerClient();
  const rows = await getAllFilteredEnrollmentRequests(supabase, filters);

  const csv = buildEnrollmentRequestsCsv(rows);
  const filename = buildEnrollmentCsvFilename();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
