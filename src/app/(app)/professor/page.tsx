import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Área do professor" };

/**
 * Página de demonstração da checagem de área por perfil ativo — sem
 * conteúdo acadêmico real (fora do escopo da Fase 1). Prova, em uma rota
 * de verdade (não só em teste unitário da política), que um perfil ativo
 * diferente de "teacher" é barrado aqui mesmo estando autenticado.
 */
export default async function ProfessorAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return (
      <AccessDenied description="Esta área é exclusiva do perfil Professor." />
    );
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold text-neutral-900">
        Área do professor
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Turmas, agenda e frequência chegam na Fase 4. Esta página existe
        nesta fase só para comprovar que a checagem de área funciona numa
        rota real.
      </p>
    </Card>
  );
}
