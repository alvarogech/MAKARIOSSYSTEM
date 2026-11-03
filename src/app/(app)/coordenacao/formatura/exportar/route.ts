import { can, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import { toCsv, toXlsx } from "@/modules/graduation/exportFile";
import { buildListTable, isListCode, LISTS, selectList, type ListCode } from "@/modules/graduation/lists";

export const dynamic = "force-dynamic";

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Exporta uma lista da formatura em CSV ou XLSX. A permissão é checada aqui, no servidor. */
export async function GET(request: Request): Promise<Response> {
  const auth = await getAuthContext();
  if (!auth) return new Response("Sessão expirada.", { status: 401 });
  if (!can(auth, { resource: "graduation", action: "export" })) return new Response("Sem permissão para exportar.", { status: 403 });

  const url = new URL(request.url);
  const list = url.searchParams.get("lista") ?? "";
  const format = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const isSelection = list === "selecionados";
  if (!isSelection && !isListCode(list)) return new Response("Lista inválida.", { status: 400 });

  const supabase = await createSupabaseServerClient();
  const edition = pickEdition(await loadEditions(supabase), url.searchParams.get("edicao") ?? undefined);
  if (!edition) return new Response("Edição não encontrada.", { status: 404 });

  const board = await loadBoard(supabase, edition);
  // "selecionados": as linhas marcadas na tabela, no formato geral. Só entram alunos que são candidatos da edição.
  const wanted = new Set((url.searchParams.get("ids") ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500));
  const rows = isSelection ? board.rows.filter((r) => wanted.has(r.studentId)) : selectList(board.rows, list as ListCode);
  const table = buildListTable(rows, isSelection ? "aptos" : (list as ListCode), edition.name);
  const label = isSelection ? "Seleção" : (LISTS.find((l) => l.code === list)?.label ?? list);
  const filename = `formatura-${slug(edition.name)}-${list}.${format}`;

  const common = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" };
  if (format === "xlsx") {
    const buffer = await toXlsx(table, label);
    return new Response(new Uint8Array(buffer), {
      headers: { ...common, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  return new Response(toCsv(table), { headers: { ...common, "Content-Type": "text/csv; charset=utf-8" } });
}
