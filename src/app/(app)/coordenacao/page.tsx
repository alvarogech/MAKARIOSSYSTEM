import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Coordenação" };

export default async function CoordenacaoAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold text-neutral-900">Coordenação</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Matrículas, turmas, temporadas e reposições chegam na Fase 2.
        Administrador acessa esta área porque herda as permissões da
        coordenação (PLANO_TECNICO.md, seção 3).
      </p>
    </Card>
  );
}
