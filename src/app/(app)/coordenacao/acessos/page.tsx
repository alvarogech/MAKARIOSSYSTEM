import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import {
  ACCESS_STAGE_LABELS,
  loadStudentAccess,
  summarize,
  type AccessStage,
} from "@/modules/access/studentAccess";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/services/phone";
import { buildWhatsAppLink } from "@/services/whatsapp";

export const metadata: Metadata = { title: "Acesso dos alunos" };

const STAGES = Object.keys(ACCESS_STAGE_LABELS) as AccessStage[];
const STAGE_STYLE: Record<AccessStage, string> = {
  sem_conta: "bg-red-50 text-red-700",
  conta_sem_login: "bg-orange-50 text-orange-700",
  entrou_sem_material: "bg-amber-50 text-amber-700",
  abriu_material: "bg-green-50 text-green-700",
};
const MAX_ROWS = 150;

function when(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export default async function AcessosPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const { f, q } = await searchParams;
  const filter = STAGES.find((s) => s === f);
  const query = (q ?? "").trim().toLowerCase();

  const supabase = await createSupabaseServerClient();
  const people = await loadStudentAccess(supabase);
  const summary = summarize(people);

  const shown = people
    .filter((p) => !filter || p.stage === filter)
    .filter((p) => !query || p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query));

  const pct = (n: number) => (summary.approved === 0 ? 0 : Math.round((n / summary.approved) * 100));
  const tab = (active: boolean) =>
    active ? "border-b-2 border-brand-blue pb-1 font-semibold text-brand-blue" : "pb-1 text-neutral-500 hover:text-neutral-800";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Acesso dos alunos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Quem, entre os alunos com inscrição aprovada, já criou a conta, já entrou na plataforma e já abriu algum material.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Aprovados", value: summary.approved, note: "inscrições aprovadas" },
          { label: "Criaram a conta", value: summary.withAccount, note: `${pct(summary.withAccount)}% dos aprovados` },
          { label: "Já entraram", value: summary.loggedIn, note: `${pct(summary.loggedIn)}% dos aprovados` },
          { label: "Abriram material", value: summary.openedMaterial, note: `${pct(summary.openedMaterial)}% dos aprovados` },
        ].map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{card.value}</p>
            <p className="text-xs text-neutral-500">{card.note}</p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-neutral-500">
        “Abriram material” só conta aberturas feitas depois de este registro entrar no ar (07/10/2026) — antes disso a plataforma
        não guardava essa informação.
      </p>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link href="?" className={tab(!filter)}>
              Todos ({summary.approved})
            </Link>
            {STAGES.map((stage) => (
              <Link key={stage} href={`?f=${stage}`} className={tab(filter === stage)}>
                {ACCESS_STAGE_LABELS[stage]} ({summary.byStage[stage]})
              </Link>
            ))}
          </div>
          <form method="get" className="flex items-center gap-2 text-sm">
            {filter ? <input type="hidden" name="f" value={filter} /> : null}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar nome ou e-mail"
              className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1"
            />
            <button type="submit" className="text-brand-blue hover:underline">
              Buscar
            </button>
          </form>
        </div>

        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {shown.slice(0, MAX_ROWS).map((p) => (
            <li key={p.personKey} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{p.name}</p>
                <p className="truncate text-xs text-neutral-500">
                  {p.volumes.join(" + ")} · {p.email}
                </p>
                <p className="text-xs text-neutral-400">
                  Último acesso: {when(p.lastSignInAt)} · Materiais abertos: {p.materialsOpened}
                  {p.lastMaterialAt ? ` (último em ${when(p.lastMaterialAt)})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLE[p.stage]}`}>
                  {ACCESS_STAGE_LABELS[p.stage]}
                </span>
                {p.stage !== "abriu_material" && isValidBrazilianPhone(p.phone) ? (
                  <a
                    href={buildWhatsAppLink(p.phone)}
                    target="_blank"
                    rel="noreferrer"
                    title={formatBrazilianPhone(p.phone)}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </li>
          ))}
          {shown.length === 0 ? <li className="py-3 text-neutral-400">Ninguém neste filtro.</li> : null}
        </ul>
        {shown.length > MAX_ROWS ? (
          <p className="text-xs text-neutral-500">
            Mostrando {MAX_ROWS} de {shown.length}. Use o filtro ou a busca para ver os demais.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
