import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadFunnel } from "@/modules/academic/funnelLoader";
import { FUNNEL_LABELS, FUNNEL_ORDER, FUNNEL_STYLE, type FunnelStage } from "@/modules/academic/studentFunnel";
import { formatHours } from "@/modules/attendance/progress";
import { isValidBrazilianPhone } from "@/services/phone";
import { buildWhatsAppLink } from "@/services/whatsapp";

export const metadata: Metadata = { title: "Alunos" };

const PAGE_SIZE = 100;

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; q?: string; volume?: string; pagina?: string; temporada?: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const { etapa, q, volume, pagina, temporada } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: seasons } = await supabase.from("seasons").select("id, name").order("starts_on", { ascending: false, nullsFirst: false });
  const season = (seasons ?? []).find((s) => s.id === temporada) ?? seasons?.[0];
  const people = season ? await loadFunnel(supabase, season.id) : [];

  const stage = FUNNEL_ORDER.find((s) => s === etapa) as FunnelStage | undefined;
  const needle = (q ?? "").trim().toLowerCase();
  const counts = Object.fromEntries(FUNNEL_ORDER.map((s) => [s, people.filter((p) => p.stage === s).length])) as Record<FunnelStage, number>;

  const filtered = people
    .filter((p) => !stage || p.stage === stage)
    .filter((p) => !volume || p.volumeNames.includes(volume))
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle) || p.cpfLast4 === needle);
  const page = Math.max(1, Number(pagina) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  const keep = (extra: Record<string, string>) =>
    `?${new URLSearchParams({ etapa: etapa ?? "", q: q ?? "", volume: volume ?? "", ...(season ? { temporada: season.id } : {}), ...extra })}`;
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-brand-blue bg-brand-blue-light text-brand-blue" : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-blue/40"}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Alunos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cada pessoa em uma única etapa: inscrito → aprovado → conta criada → matriculado → frequentando → em risco → concluído ou não
          aprovado. Clique no nome para abrir a ficha completa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filtrar por etapa">
        <Link href={keep({ etapa: "", pagina: "" })} className={chip(!stage)}>
          Todas ({people.length})
        </Link>
        {FUNNEL_ORDER.map((s) => (
          <Link key={s} href={keep({ etapa: stage === s ? "" : s, pagina: "" })} className={chip(stage === s)}>
            {FUNNEL_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          {stage ? <input type="hidden" name="etapa" value={stage} /> : null}
          {season ? <input type="hidden" name="temporada" value={season.id} /> : null}
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Buscar
            <input name="q" defaultValue={q ?? ""} placeholder="Nome, e-mail ou final do CPF" className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Volume
            <select name="volume" defaultValue={volume ?? ""} className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {["Essência", "Caminho", "Voz"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="pb-1.5 text-brand-blue hover:underline">
            Filtrar
          </button>
        </form>

        <p className="text-xs text-neutral-500">
          {filtered.length} pessoa(s){filtered.length > PAGE_SIZE ? ` · mostrando ${start + 1} a ${Math.min(start + PAGE_SIZE, filtered.length)}` : ""}
        </p>

        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {rows.map((p) => (
            <li key={p.requestId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <Link href={`/coordenacao/alunos/${p.requestId}`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                  {p.name}
                </Link>
                <p className="truncate text-xs text-neutral-500">
                  {p.courses.join(" + ")} · {p.email}
                </p>
                <p className="text-xs text-neutral-400">
                  {p.totalMinutes > 0 ? `${formatHours(p.attendedMinutes)} de ${formatHours(p.totalMinutes)}${p.pctSoFar !== null ? ` · ${p.pctSoFar}% dos encontros realizados` : ""}` : "sem turma ainda"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FUNNEL_STYLE[p.stage]}`}>{FUNNEL_LABELS[p.stage]}</span>
                {isValidBrazilianPhone(p.phone) ? (
                  <a
                    href={buildWhatsAppLink(p.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </li>
          ))}
          {rows.length === 0 ? <li className="py-3 text-neutral-400">Ninguém neste filtro.</li> : null}
        </ul>

        {filtered.length > PAGE_SIZE ? (
          <div className="flex gap-4 text-sm">
            {page > 1 ? (
              <Link className="text-brand-blue hover:underline" href={keep({ pagina: String(page - 1) })}>
                ← Anteriores
              </Link>
            ) : null}
            {start + PAGE_SIZE < filtered.length ? (
              <Link className="text-brand-blue hover:underline" href={keep({ pagina: String(page + 1) })}>
                Próximos →
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
