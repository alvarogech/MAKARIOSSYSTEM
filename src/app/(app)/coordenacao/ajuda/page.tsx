import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { buildWhatsAppLink } from "@/services/whatsapp";
import { setHelpRequestStatus } from "@/modules/support/actions/manageHelpRequests";
import { helpProblemLabel } from "@/modules/support/helpRequest";
import { SendAccessLinkButton } from "@/modules/enrollment/components/SendAccessLinkButton";

export const metadata: Metadata = { title: "Pedidos de ajuda" };

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

const formatPhone = (digits: string) => {
  const d = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : digits;
};

export default async function PedidosDeAjudaPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const { ver } = await searchParams;
  const showResolved = ver === "resolvidos";
  const supabase = await createSupabaseServerClient();

  const [{ data: rows }, { count: openCount }] = await Promise.all([
    supabase
      .from("help_requests")
      .select("id, full_name, cpf_hash, cpf_last4, phone, problems, message, enrollment_request_id, status, created_at, resolved_at")
      .eq("status", showResolved ? "resolvido" : "aberto")
      .order(showResolved ? "resolved_at" : "created_at", { ascending: !showResolved })
      .limit(200),
    supabase.from("help_requests").select("id", { count: "exact", head: true }).eq("status", "aberto"),
  ]);
  const requests = rows ?? [];

  // Para cada pedido: se o aluno ainda não criou a conta (botão de mandar o
  // acesso) e os erros que a chamada por QR mostrou para ele.
  const requestIds = [...new Set(requests.map((r) => r.enrollment_request_id).filter((id): id is string => !!id))];
  const cpfHashes = [...new Set(requests.map((r) => r.cpf_hash))];
  const [{ data: enrollmentRows }, { data: failureRows }] = await Promise.all([
    requestIds.length > 0
      ? supabase.from("enrollment_requests").select("id, status, student_id").in("id", requestIds)
      : Promise.resolve({ data: [] as { id: string; status: string; student_id: string | null }[] }),
    cpfHashes.length > 0
      ? supabase
          .from("attendance_scan_failures")
          .select("id, created_at, step, code, message, cpf_hash, enrollment_request_id, had_location")
          .or(
            requestIds.length > 0
              ? `cpf_hash.in.(${cpfHashes.join(",")}),enrollment_request_id.in.(${requestIds.join(",")})`
              : `cpf_hash.in.(${cpfHashes.join(",")})`,
          )
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
  ]);
  const withoutAccount = new Set(
    (enrollmentRows ?? []).filter((e) => e.status === "approved" && !e.student_id).map((e) => e.id),
  );
  const failuresOf = (r: (typeof requests)[number]) =>
    (failureRows ?? [])
      .filter((f) => f.cpf_hash === r.cpf_hash || (!!r.enrollment_request_id && f.enrollment_request_id === r.enrollment_request_id))
      .slice(0, 5);

  const link = `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/ajuda`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-brand-blue-dark">Pedidos de ajuda</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {showResolved ? "Os resolvidos mais recentes aparecem primeiro." : "O que os alunos mandam pela página de ajuda. Os mais antigos aparecem primeiro, para ninguém ficar esquecido."}
        </p>
      </div>

      <Card className="flex flex-col gap-2 py-4">
        <p className="text-sm font-medium text-neutral-900">Link para mandar aos alunos</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-[var(--radius-sm)] bg-neutral-50 px-2 py-1 text-sm text-neutral-700">{link}</code>
          <CopyButton value={link} label="link da página de ajuda" />
        </div>
        <p className="text-xs text-neutral-500">Não precisa de login. O aluno informa nome, CPF, WhatsApp e o problema.</p>
      </Card>

      <nav className="flex gap-2 text-sm" aria-label="Filtrar pedidos">
        <Link
          href="/coordenacao/ajuda"
          className={`rounded-full px-3 py-1.5 ${showResolved ? "text-neutral-600 hover:bg-neutral-100" : "bg-brand-blue font-medium text-white"}`}
        >
          Em aberto ({openCount ?? 0})
        </Link>
        <Link
          href="/coordenacao/ajuda?ver=resolvidos"
          className={`rounded-full px-3 py-1.5 ${showResolved ? "bg-brand-blue font-medium text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
        >
          Resolvidos
        </Link>
      </nav>

      {requests.length === 0 ? (
        <Card className="py-8 text-center text-sm text-neutral-500">
          {showResolved ? "Nenhum pedido resolvido ainda." : "Nenhum pedido em aberto. Tudo em dia."}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{r.full_name}</p>
                    <p className="text-xs text-neutral-500">
                      Enviado em {when(r.created_at)} · CPF final {r.cpf_last4}
                      {r.resolved_at ? ` · resolvido em ${when(r.resolved_at)}` : ""}
                    </p>
                  </div>
                  {r.enrollment_request_id ? (
                    <Link
                      href={`/coordenacao/alunos/${r.enrollment_request_id}`}
                      className="text-sm font-medium text-brand-blue hover:underline"
                    >
                      Abrir ficha do aluno
                    </Link>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">CPF sem inscrição</span>
                  )}
                </div>

                {r.problems.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {r.problems.map((p) => (
                      <li key={p} className="rounded-full bg-brand-blue-light px-2.5 py-1 text-xs text-brand-blue-dark">
                        {helpProblemLabel(p)}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {r.message ? (
                  <p className="whitespace-pre-line rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    {r.message}
                  </p>
                ) : null}

                {failuresOf(r).length > 0 ? (
                  <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                    <p className="font-medium text-amber-900">O que a chamada mostrou para este aluno</p>
                    <ul className="mt-1 flex flex-col gap-1 text-amber-900">
                      {failuresOf(r).map((f) => (
                        <li key={f.id}>
                          <span className="text-xs text-amber-700">{when(f.created_at)}</span>{" "}
                          {f.code === "excecao" ? "Falha no servidor ao carregar a chamada." : f.message}
                          {f.had_location ? "" : <span className="text-xs text-amber-700"> (sem localização)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={buildWhatsAppLink(r.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-success px-3 text-sm font-medium text-white hover:opacity-90"
                  >
                    WhatsApp {formatPhone(r.phone)}
                  </a>
                  {r.enrollment_request_id && withoutAccount.has(r.enrollment_request_id) ? (
                    <SendAccessLinkButton requestId={r.enrollment_request_id} />
                  ) : null}
                  <form action={setHelpRequestStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={r.status === "aberto" ? "resolvido" : "aberto"} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:border-brand-blue hover:text-brand-blue"
                    >
                      {r.status === "aberto" ? "Marcar como resolvido" : "Reabrir"}
                    </button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
