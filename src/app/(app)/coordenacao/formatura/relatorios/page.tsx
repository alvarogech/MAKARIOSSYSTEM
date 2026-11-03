import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import { EditionBar } from "@/modules/graduation/components/EditionBar";
import { CertificateNameForm } from "@/modules/graduation/components/StudentPanels";
import { OverallBadge } from "@/modules/graduation/components/badges";
import { certificateNameOf, isListCode, LISTS, selectList } from "@/modules/graduation/lists";

export const metadata: Metadata = { title: "Relatórios — Formatura" };
export const dynamic = "force-dynamic";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "graduation", action: "view" })) {
    return <AccessDenied description="Você não tem permissão para ver a Central de Formatura." />;
  }

  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const editions = await loadEditions(supabase);
  const edition = pickEdition(editions, typeof params.edicao === "string" ? params.edicao : undefined);
  if (!edition) {
    return (
      <Card>
        <p className="text-sm text-neutral-600">
          Ainda não há edição de formatura. <Link className="text-brand-blue underline" href="/coordenacao/formatura">Crie a primeira na Visão geral.</Link>
        </p>
      </Card>
    );
  }

  const board = await loadBoard(supabase, edition);
  const canExport = can(auth, { resource: "graduation", action: "export" });
  const canConfigure = can(auth, { resource: "graduation", action: "configure" });
  const requested = typeof params.lista === "string" && isListCode(params.lista) ? params.lista : null;
  const shown = requested ? selectList(board.rows, requested) : [];
  const exportHref = (code: string, format: "csv" | "xlsx") => `/coordenacao/formatura/exportar?edicao=${edition.id}&lista=${code}&formato=${format}`;

  return (
    <div className="flex flex-col gap-6">
      <EditionBar editions={editions} current={edition} computedAt={board.computedAt} />

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Listas e relatórios</h2>
        <p className="text-sm text-neutral-600">
          Cada lista é um recorte dos candidatos calculados agora. A lista final só leva quem confirmou presença e continua apto; os certificados só levam alunos aptos.
        </p>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {LISTS.map((l) => {
          const count = selectList(board.rows, l.code).length;
          return (
            <li key={l.code}>
              <Card className={`flex flex-col gap-3 py-4 ${requested === l.code ? "border-brand-blue" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/coordenacao/formatura/relatorios?edicao=${edition.id}&lista=${l.code}#lista`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                    {l.label}
                  </Link>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-sm font-semibold text-neutral-800">{count}</span>
                </div>
                {canExport ? (
                  <div className="flex flex-wrap gap-2">
                    <a href={exportHref(l.code, "csv")} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      <Download className="size-3.5" aria-hidden="true" />
                      CSV
                    </a>
                    <a href={exportHref(l.code, "xlsx")} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      <Download className="size-3.5" aria-hidden="true" />
                      Excel (XLSX)
                    </a>
                    {l.code === "final" ? (
                      <Link href={`/coordenacao/formatura/relatorios/imprimir?edicao=${edition.id}&lista=final`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        <Printer className="size-3.5" aria-hidden="true" />
                        Imprimir
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      {requested ? (
        <section id="lista" className="flex scroll-mt-4 flex-col gap-3">
          <h3 className="font-semibold text-neutral-900">
            {LISTS.find((l) => l.code === requested)?.label} <span className="text-sm font-normal text-neutral-500">({shown.length})</span>
          </h3>

          {requested === "certificados" ? (
            <ul className="flex flex-col gap-3">
              {shown.length === 0 ? <Card className="py-8 text-center text-sm text-neutral-500">Nenhum aluno apto ainda. Certificados só são preparados para alunos aptos.</Card> : null}
              {shown.map((r) => {
                const cert = certificateNameOf(r);
                return (
                  <li key={r.studentId}>
                    <Card className="flex flex-col gap-2 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/coordenacao/formatura/${r.studentId}?edicao=${edition.id}`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                          {r.name}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cert.checked ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {cert.checked ? "Nome conferido" : "Nome a conferir"}
                        </span>
                      </div>
                      {cert.issues.length > 0 ? <p className="text-xs text-amber-700">Atenção no cadastro: {cert.issues.join("; ")}.</p> : null}
                      {canConfigure ? <CertificateNameForm editionId={edition.id} studentId={r.studentId} suggested={cert.name} checked={cert.checked} /> : <p className="text-sm text-neutral-700">{cert.name}</p>}
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : shown.length === 0 ? (
            <Card className="py-8 text-center text-sm text-neutral-500">Nenhum aluno nesta lista.</Card>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-neutral-200 bg-white">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Aluno</th>
                    <th className="px-3 py-2">Turma</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2">Resposta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {shown.map((r) => (
                    <tr key={r.studentId}>
                      <td className="px-3 py-2">
                        <Link href={`/coordenacao/formatura/${r.studentId}?edicao=${edition.id}`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{r.className ?? "—"}</td>
                      <td className="px-3 py-2">
                        <OverallBadge status={r.evaluation.overall} />
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        {!r.participant.invitedAt ? "Não convidado" : r.participant.response === "confirmado" ? "Confirmou" : r.participant.response === "nao_comparece" ? "Não comparecerá" : "Sem resposta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
