import type { Metadata } from "next";
import Link from "next/link";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";
import { addParticipant } from "@/modules/graduation/actions/editions";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import { applyFilters, parseFilters, summarize } from "@/modules/graduation/boardView";
import { CandidatesTable } from "@/modules/graduation/components/CandidatesTable";
import { CreateEditionForm, SyncCandidatesButton } from "@/modules/graduation/components/EditionForms";
import { EditionBar } from "@/modules/graduation/components/EditionBar";
import { FiltersBar } from "@/modules/graduation/components/FiltersBar";
import { PENDENCY_LABELS, type PendencyCategory } from "@/modules/graduation/types";
import { toCandidateVM } from "@/modules/graduation/viewModel";

export const metadata: Metadata = { title: "Formatura" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Stat({ label, value, hint, href, tone }: { label: string; value: number; hint: string; href: string; tone: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4 transition-colors hover:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
    >
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className={`text-3xl font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-neutral-500 group-hover:text-brand-blue">{hint}</span>
    </Link>
  );
}

export default async function FormaturaPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "graduation", action: "view" })) {
    return <AccessDenied description="Você não tem permissão para ver a Central de Formatura." />;
  }

  const params = await searchParams;
  const filters = parseFilters(params);
  const supabase = await createSupabaseServerClient();
  const [editions, { data: seasons }] = await Promise.all([
    loadEditions(supabase),
    supabase.from("seasons").select("id, name").order("starts_on", { ascending: false }),
  ]);
  const seasonOptions = seasons ?? [];

  const requested = typeof params.edicao === "string" ? params.edicao : undefined;
  const edition = pickEdition(editions, requested);

  if (!edition) {
    return (
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold text-neutral-900">Crie a primeira edição da formatura</h2>
          <p className="mt-1 text-sm text-neutral-600">
            A edição reúne os candidatos, guarda convites e confirmações e mantém o histórico mesmo quando a situação acadêmica muda.
          </p>
        </div>
        <CreateEditionForm seasons={seasonOptions} />
      </Card>
    );
  }

  const board = await loadBoard(supabase, edition);
  const summary = summarize(board.rows);
  const filtered = applyFilters(board.rows, filters);
  const todayKey = getSaoPauloDateKey(new Date());
  const canConfigure = can(auth, { resource: "graduation", action: "configure" });
  const canExport = can(auth, { resource: "graduation", action: "export" });
  const canValidateHistory = can(auth, { resource: "graduation", action: "validate_history" });

  const base = `/coordenacao/formatura?edicao=${edition.id}`;
  const turmas = [...new Set(board.rows.map((r) => r.className).filter((x): x is string => !!x))].sort();
  const temporadas = [...new Set(board.rows.map((r) => r.seasonName).filter((x): x is string => !!x))].sort();

  const categories = (Object.entries(summary.byCategory) as [PendencyCategory, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const maxCategory = categories[0]?.[1] ?? 1;
  const nameOf = new Map(board.rows.map((r) => [r.studentId, r.name]));

  // Inclusão manual: busca um aluno pelo nome ou e-mail entre quem ainda não está na edição.
  // Vírgulas e parênteses têm significado na sintaxe do filtro .or(): saem da busca.
  const search = typeof params.incluir === "string" ? params.incluir.replace(/[,()*]/g, " ").trim().slice(0, 60) : "";
  const inEdition = new Set(board.rows.map((r) => r.studentId));
  const found =
    canConfigure && search.length >= 3
      ? ((
          await supabase
            .from("profiles")
            .select("id, full_name, email")
            .or(`full_name.ilike.%${escapeIlike(search)}%,email.ilike.%${escapeIlike(search)}%`)
            .eq("is_demo", false)
            .limit(12)
        ).data ?? []).filter((p) => !inEdition.has(p.id))
      : [];

  return (
    <div className="flex flex-col gap-6">
      <EditionBar editions={editions} current={edition} computedAt={board.computedAt} />

      {board.conflicts.length > 0 ? (
        <Alert variant="warning">
          <p className="font-medium">
            {board.conflicts.length} aluno(s) convidado(s) deixaram de estar aptos depois do convite, porque um registro acadêmico mudou.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {board.conflicts.map((c) => (
              <li key={c.studentId}>
                <Link href={`/coordenacao/formatura/${c.studentId}?edicao=${edition.id}`} className="underline">
                  {nameOf.get(c.studentId) ?? c.studentId}
                </Link>
                {c.response === "confirmado" ? " (já tinha confirmado presença)" : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">O convite não foi desfeito sozinho: confira o caso e decida.</p>
        </Alert>
      ) : null}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Candidatos à formatura" value={summary.candidates} hint="ver todos" href={`${base}#candidatos`} tone="text-neutral-900" />
        <Stat label="Aptos" value={summary.apto} hint="todos os requisitos cumpridos" href={`${base}&status=apto#candidatos`} tone="text-green-700" />
        <Stat label="Com pendências" value={summary.pendente} hint="podem ser regularizados" href={`${base}&status=pendente#candidatos`} tone="text-amber-700" />
        <Stat label="Em conferência" value={summary.em_conferencia} hint="faltam evidências" href={`${base}&status=em_conferencia#candidatos`} tone="text-violet-700" />
        <Stat label="Não aptos" value={summary.nao_apto} hint="sem caminho aberto" href={`${base}&status=nao_apto#candidatos`} tone="text-red-700" />
        <Stat label="A uma pendência de apto" value={summary.nearlyDone} hint="foco da regularização" href={`${base}&status=pendente&quantidade=1#candidatos`} tone="text-brand-blue" />
      </section>

      {summary.em_andamento > 0 ? (
        <p className="-mt-3 text-sm text-neutral-600">
          {summary.em_andamento} aluno(s) ainda <Link className="underline" href={`${base}&status=em_andamento#candidatos`}>em andamento</Link>: aulas ou avaliação ainda não encerradas, sem pendência a cobrar.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 lg:col-span-2">
          <div>
            <h2 className="font-semibold text-neutral-900">O que mais trava a formatura</h2>
            <p className="text-sm text-neutral-600">Alunos com cada tipo de pendência aberta (um aluno pode estar em mais de uma).</p>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma pendência aberta entre os candidatos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {categories.map(([category, count]) => (
                <li key={category}>
                  <Link href={`${base}&pendencia=${category}#candidatos`} className="group flex items-center gap-3 text-sm">
                    <span className="w-48 shrink-0 text-neutral-700 group-hover:text-brand-blue">{PENDENCY_LABELS[category]}</span>
                    <span className="h-3 flex-1 rounded-full bg-neutral-100">
                      <span className="block h-3 rounded-full bg-amber-400" style={{ width: `${Math.max(6, (count / maxCategory) * 100)}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right font-semibold text-neutral-900">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold text-neutral-900">Próximos passos</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link className="text-brand-blue hover:underline" href={`/coordenacao/formatura/regularizacao?edicao=${edition.id}`}>
                {summary.toContact} aluno(s) com pendência ainda sem contato →
              </Link>
            </li>
            <li className="text-neutral-700">{summary.regularized} regularizado(s) e hoje aptos</li>
            <li>
              <Link className="text-brand-blue hover:underline" href={`/coordenacao/formatura/cerimonia?edicao=${edition.id}`}>
                Cerimônia: {edition.publishedAt ? "publicada" : "ainda em planejamento"} →
              </Link>
            </li>
          </ul>
          {canConfigure ? <SyncCandidatesButton editionId={edition.id} /> : null}
        </Card>
      </div>

      <section id="candidatos" className="flex scroll-mt-4 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            Candidatos <span className="text-sm font-normal text-neutral-500">({filtered.length} de {board.rows.length})</span>
          </h2>
        </div>
        <FiltersBar
          filters={filters}
          editionId={edition.id}
          action="/coordenacao/formatura"
          turmas={turmas}
          temporadas={temporadas}
          responsibles={board.responsibles}
        />
        <CandidatesTable rows={filtered.map((r) => toCandidateVM(r, todayKey))} editionId={edition.id} canInvite={canConfigure} canExport={canExport} canValidateHistory={canValidateHistory} />
      </section>

      {canConfigure ? (
        <details className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4" open={search.length > 0}>
          <summary className="cursor-pointer text-sm font-medium text-neutral-800">Incluir um aluno manualmente (por exemplo, quem concluiu em temporadas anteriores)</summary>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="edicao" value={edition.id} />
            <div>
              <label htmlFor="incluir" className="mb-1 block text-xs font-medium text-neutral-500">
                Nome ou e-mail (mínimo 3 letras)
              </label>
              <input id="incluir" name="incluir" defaultValue={search} className="h-10 w-72 max-w-full rounded-[var(--radius-sm)] border border-neutral-200 px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue" />
            </div>
            <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Buscar
            </button>
          </form>
          {search.length >= 3 ? (
            found.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Ninguém encontrado fora da edição.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
                {found.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {p.full_name} <span className="text-neutral-500">{p.email}</span>
                    </span>
                    <form action={addParticipant}>
                      <input type="hidden" name="editionId" value={edition.id} />
                      <input type="hidden" name="studentId" value={p.id} />
                      <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Incluir na edição
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          <p className="mt-3 text-xs text-neutral-500">Incluir não aprova ninguém: a situação continua sendo calculada pelos registros e pelo histórico validado.</p>
        </details>
      ) : null}

      {canConfigure ? (
        <details className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-neutral-800">Criar outra edição</summary>
          <div className="mt-3">
            <CreateEditionForm seasons={seasonOptions} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
