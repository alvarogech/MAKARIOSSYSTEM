import type { Metadata } from "next";
import Link from "next/link";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import { PrintButton } from "@/modules/graduation/components/PrintButton";
import { formatDay } from "@/modules/graduation/dates";
import { certificateNameOf, isListCode, LISTS, selectList } from "@/modules/graduation/lists";

export const metadata: Metadata = { title: "Lista para impressão — Formatura" };
export const dynamic = "force-dynamic";

/** Lista simples, em preto e branco, pronta para imprimir (a lista final por padrão). */
export default async function ImprimirPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "graduation", action: "export" })) {
    return <AccessDenied description="Você não tem permissão para imprimir listas de formatura." />;
  }

  const params = await searchParams;
  const code = typeof params.lista === "string" && isListCode(params.lista) ? params.lista : "final";
  const supabase = await createSupabaseServerClient();
  const edition = pickEdition(await loadEditions(supabase), typeof params.edicao === "string" ? params.edicao : undefined);
  if (!edition) return <p className="text-sm text-neutral-600">Edição não encontrada.</p>;

  const board = await loadBoard(supabase, edition);
  const rows = selectList(board.rows, code);
  const label = LISTS.find((l) => l.code === code)?.label ?? code;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 bg-white p-2 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/coordenacao/formatura/relatorios?edicao=${edition.id}`} className="text-sm text-brand-blue hover:underline">
          ← Voltar aos relatórios
        </Link>
        <PrintButton />
      </div>
      <header className="border-b border-neutral-300 pb-3">
        <h1 className="text-xl font-semibold text-neutral-900">{edition.name}</h1>
        <p className="text-sm text-neutral-700">
          {label} · {rows.length} aluno(s)
          {edition.eventDate ? ` · ${formatDay(edition.eventDate)}${edition.eventTime ? ` às ${edition.eventTime}` : ""}` : ""}
          {edition.locationName ? ` · ${edition.locationName}` : ""}
        </p>
        <p className="text-xs text-neutral-500">Gerada em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date())}</p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">Nenhum aluno nesta lista.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-400 text-xs uppercase">
              <th className="w-10 py-1.5">Nº</th>
              <th className="py-1.5">Nome</th>
              <th className="py-1.5">Turma de Voz</th>
              <th className="w-28 py-1.5">Presença</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.studentId} className="border-b border-neutral-200">
                <td className="py-1.5 text-neutral-500">{index + 1}</td>
                <td className="py-1.5 font-medium">{certificateNameOf(r).name}</td>
                <td className="py-1.5 text-neutral-700">{r.className ?? "—"}</td>
                <td className="py-1.5">
                  <span className="inline-block h-4 w-4 border border-neutral-500 align-middle" aria-label="Marcar presença" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
