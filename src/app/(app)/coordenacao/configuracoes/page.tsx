import type { Metadata } from "next";
import Link from "next/link";
import { can, canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { ReportSwitch } from "@/modules/academic/components/ReportSwitch";

export const metadata: Metadata = { title: "Configurações" };

const ITEMS = [
  {
    href: "/coordenacao/temporadas",
    title: "Temporadas e ofertas",
    description: "Criar a temporada (ex.: 2026.2), as ofertas de Essência, Caminho e Voz nela e o modelo de horário das turmas.",
  },
  {
    href: "/coordenacao/locais",
    title: "Locais",
    description: "Espaços das aulas: endereço, coordenadas para a chamada por QR, sala, estacionamento e recursos.",
  },
  {
    href: "/coordenacao/importar",
    title: "Importar alunos",
    description: "Importação em lote por planilha (.csv ou .xlsx), com relatório linha por linha.",
  },
  {
    href: "/coordenacao/presenca",
    title: "Chamada por QR Code",
    description: "QR Codes dos volumes, exigência de localização e janelas de autodeclaração.",
  },
];

export default async function ConfiguracoesPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  // Bloco "Aulas": só o administrador altera.
  const isAdmin = can(auth, { resource: "seasons", action: "set_report_requirement" });
  let seasonSwitches: { id: string; name: string; enabled: boolean; changedLabel: string | null }[] = [];
  if (isAdmin) {
    const supabase = await createSupabaseServerClient();
    const { data: seasons } = await supabase
      .from("seasons")
      .select("id, name, status, require_class_report, require_class_report_changed_by, require_class_report_changed_at")
      .in("status", ["open", "planning"])
      .order("starts_on", { ascending: false, nullsFirst: false });
    const changerIds = [...new Set((seasons ?? []).map((s) => s.require_class_report_changed_by).filter((id): id is string => Boolean(id)))];
    const { data: changers } = changerIds.length ? await supabase.from("profiles").select("id, full_name").in("id", changerIds) : { data: [] };
    const nameById = new Map((changers ?? []).map((p) => [p.id, p.full_name]));
    seasonSwitches = (seasons ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      enabled: s.require_class_report,
      changedLabel: s.require_class_report_changed_at
        ? `Alterado por ${nameById.get(s.require_class_report_changed_by ?? "") ?? "administrador"} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(s.require_class_report_changed_at))}`
        : null,
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configurações</h1>
        <p className="mt-1 text-sm text-neutral-500">O que se mexe pouco: a estrutura da temporada, os locais e as importações.</p>
      </div>
      {isAdmin ? (
        <section aria-labelledby="config-aulas" className="flex flex-col gap-2">
          <h2 id="config-aulas" className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Aulas
          </h2>
          {seasonSwitches.map((season) => (
            <ReportSwitch key={season.id} seasonId={season.id} seasonName={season.name} enabled={season.enabled} changedLabel={season.changedLabel} />
          ))}
          {seasonSwitches.length === 0 ? <p className="text-sm text-neutral-500">Nenhum semestre aberto ou em planejamento.</p> : null}
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:border-brand-blue">
              <h2 className="font-semibold text-neutral-900">{item.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
