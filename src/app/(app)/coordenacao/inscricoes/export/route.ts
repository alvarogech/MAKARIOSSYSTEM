import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { buildEnrollmentCsvFilename, buildEnrollmentRequestsCsv } from "@/modules/enrollment/csv";
import { parseEnrollmentFilters } from "@/modules/enrollment/filters";
import { getAllFilteredEnrollmentRequests, getEnrollmentRequestsByIds } from "@/modules/enrollment/queries";

/**
 * Exportação CSV das inscrições. Duas formas, escolhidas pela presença de
 * `?ids=`:
 * - sem `ids`: respeita os filtros/busca/ordenação ativos na tela (mesmos
 *   parâmetros da URL da página);
 * - com `ids` (lista separada por vírgula): exporta só os selecionados,
 *   sempre revalidados contra o banco (nunca confia em dado vindo do
 *   cliente sem checar RLS de novo).
 *
 * Protegida em duas camadas: a checagem de autorização abaixo (nega antes
 * de qualquer consulta) e a RLS de `enrollment_requests` (o client usado
 * aqui é o autenticado, não o administrativo — se por algum bug esta
 * checagem falhasse, a RLS ainda bloquearia quem não é coordenação/admin).
 */
export async function GET(request: Request) {
  const authContext = await getAuthContext();

  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return NextResponse.json({ error: "Você não tem permissão para exportar inscrições." }, { status: 403 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  const supabase = await createSupabaseServerClient();

  let rows;
  let exportType: "selected" | "filtered";

  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 500);
    rows = await getEnrollmentRequestsByIds(supabase, ids);
    exportType = "selected";
  } else {
    const filters = parseEnrollmentFilters((key) => url.searchParams.get(key));
    rows = await getAllFilteredEnrollmentRequests(supabase, filters);
    exportType = "filtered";
  }

  const csv = buildEnrollmentRequestsCsv(rows);
  const filename = buildEnrollmentCsvFilename();

  await supabase.rpc("log_enrollment_admin_action", {
    p_action: "EXPORT",
    p_entity_id: exportType,
    p_new_value: { type: exportType, count: rows.length },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
