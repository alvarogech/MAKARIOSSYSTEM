import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configurações</h1>
        <p className="mt-1 text-sm text-neutral-500">O que se mexe pouco: a estrutura da temporada, os locais e as importações.</p>
      </div>
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
