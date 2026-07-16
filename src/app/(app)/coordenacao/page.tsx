import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Coordenação" };

const SECTIONS = [
  {
    href: "/coordenacao/temporadas",
    title: "Temporadas e ofertas de volume",
    description: "Criar temporada (ex.: 2026.2) e as ofertas de Essência/Caminho/Voz nela.",
  },
  {
    href: "/coordenacao/turmas",
    title: "Turmas e professores",
    description: "Criar turmas a partir dos modelos de horário e designar professores.",
  },
  {
    href: "/coordenacao/matriculas",
    title: "Matrículas",
    description: "Matricular alunos, com bloqueio e exceção de pré-requisito.",
  },
  {
    href: "/coordenacao/importar",
    title: "Importar alunos",
    description: "Importação em lote por planilha (.csv/.xlsx), com relatório por linha.",
  },
  {
    href: "/coordenacao/relatorios",
    title: "Relatórios pós-aula",
    description: "O que os professores reportaram após cada encontro.",
  },
];

export default async function CoordenacaoAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Coordenação</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Administração acadêmica da Escola Makários (Fase 2). Frequência,
          avaliações, reposições e certificados chegam nas próximas fases.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:border-brand-blue">
              <h2 className="font-semibold text-neutral-900">{section.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{section.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
