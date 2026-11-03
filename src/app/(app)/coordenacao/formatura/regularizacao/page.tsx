import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import {
  applyFilters,
  claimsRegularizedButNot,
  CONTACT_LABELS,
  contactStatusOf,
  inTab,
  isOverdue,
  nearestDue,
  parseFilters,
  REGULARIZATION_TABS,
  sortForRegularization,
} from "@/modules/graduation/boardView";
import { EditionBar } from "@/modules/graduation/components/EditionBar";
import { FiltersBar } from "@/modules/graduation/components/FiltersBar";
import { OverallBadge, REQUIREMENT_STYLE } from "@/modules/graduation/components/badges";
import { buildContactLink, buildContactMessage } from "@/modules/graduation/contactMessage";
import { formatShortDay } from "@/modules/graduation/dates";
import { CopyButton } from "@/components/ui/CopyButton";

export const metadata: Metadata = { title: "Regularização — Formatura" };
export const dynamic = "force-dynamic";

export default async function RegularizacaoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "graduation", action: "view" })) {
    return <AccessDenied description="Você não tem permissão para ver a Central de Formatura." />;
  }

  const params = await searchParams;
  const filters = parseFilters(params);
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
  const todayKey = getSaoPauloDateKey(new Date());
  const canContact = can(auth, { resource: "graduation", action: "contact" });

  const tab = REGULARIZATION_TABS.some((t) => t.code === filters.aba) ? filters.aba : "todos";
  const counts = new Map(REGULARIZATION_TABS.map((t) => [t.code, board.rows.filter((r) => inTab(r, t.code)).length]));
  const inCurrentTab = board.rows.filter((r) => inTab(r, tab));
  const rows = sortForRegularization(applyFilters(inCurrentTab, { ...filters, aba: tab }), todayKey);

  const turmas = [...new Set(board.rows.map((r) => r.className).filter((x): x is string => !!x))].sort();
  const temporadas = [...new Set(board.rows.map((r) => r.seasonName).filter((x): x is string => !!x))].sort();
  const tabHref = (code: string) => `/coordenacao/formatura/regularizacao?edicao=${edition.id}&aba=${code}`;

  return (
    <div className="flex flex-col gap-5">
      <EditionBar editions={editions} current={edition} computedAt={board.computedAt} />

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Central de regularização</h2>
        <p className="text-sm text-neutral-600">
          Quem está a uma pendência de concluir vem primeiro, depois quem tem prazo próximo e quem ainda não foi contatado. Um aluno só sai da fila quando os registros acadêmicos mostram a pendência resolvida.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por situação">
        {REGULARIZATION_TABS.map((t) => (
          <Link
            key={t.code}
            href={tabHref(t.code)}
            aria-current={tab === t.code ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === t.code ? "bg-brand-blue font-medium text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:border-brand-blue"}`}
          >
            {t.label} <span className={tab === t.code ? "text-white/80" : "text-neutral-400"}>({counts.get(t.code) ?? 0})</span>
          </Link>
        ))}
      </nav>

      <FiltersBar
        filters={filters}
        editionId={edition.id}
        action="/coordenacao/formatura/regularizacao"
        turmas={turmas}
        temporadas={temporadas}
        responsibles={board.responsibles}
        hidden={{ aba: tab }}
      />

      {rows.length === 0 ? (
        <Card className="py-10 text-center text-sm text-neutral-500">
          {tab === "regularizados" ? "Ninguém regularizado ainda: só entra aqui quem foi acompanhado e hoje está apto nos registros." : "Nenhum aluno nesta visão. Tudo em dia."}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const open = row.evaluation.requirements.filter((r) => r.blocking && r.state !== "cumprido" && r.state !== "em_andamento");
            const message = buildContactMessage(row.name, open);
            const due = nearestDue(row);
            const overdue = isOverdue(row, todayKey);
            return (
              <li key={row.studentId}>
                <Card className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/coordenacao/formatura/${row.studentId}?edicao=${edition.id}`} className="text-base font-semibold text-neutral-900 hover:text-brand-blue hover:underline">
                        {row.name}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {row.className ?? "Sem turma de Voz"} · {CONTACT_LABELS[contactStatusOf(row)]}
                        {row.followUp?.responsibleName ? ` · ${row.followUp.responsibleName}` : " · sem responsável"}
                        {due ? ` · prazo ${formatShortDay(due)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.evaluation.nearlyDone ? <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-xs font-medium text-brand-blue-dark">a uma pendência</span> : null}
                      {overdue ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">prazo vencido</span> : null}
                      <OverallBadge status={row.evaluation.overall} />
                    </div>
                  </div>

                  {claimsRegularizedButNot(row) ? (
                    <Alert variant="warning">Marcado como regularizado, mas os registros acadêmicos ainda mostram pendência.</Alert>
                  ) : null}

                  {open.length > 0 ? (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {open.map((r) => (
                        <li key={r.key} className="flex flex-wrap items-start gap-2">
                          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REQUIREMENT_STYLE[r.state].className}`}>{REQUIREMENT_STYLE[r.state].label}</span>
                          <span className="min-w-0 flex-1 text-neutral-800">
                            <span className="font-medium">{r.title}.</span> <span className="text-neutral-600">{r.reason}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    <span className="font-medium">Próxima ação:</span>{" "}
                    {row.followUp?.nextStep ?? open[0]?.guidance ?? (row.evaluation.overall === "apto" ? "Nenhuma: o aluno está apto." : "Aguardar a conclusão das etapas em andamento.")}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {canContact && row.phone ? (
                      <a href={buildContactLink(row.phone, message)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm" })}>
                        <MessageCircle className="size-4" aria-hidden="true" />
                        Entrar em contato
                      </a>
                    ) : null}
                    {canContact ? <CopyButton value={message} label="mensagem" /> : null}
                    <Link href={`/coordenacao/formatura/${row.studentId}?edicao=${edition.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Abrir ficha e registrar contato
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
