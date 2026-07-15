import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { ImportStudentsForm } from "@/modules/academic/components/ImportStudentsForm";

export const metadata: Metadata = { title: "Importar alunos" };

export default async function ImportarPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold text-neutral-900">
        Importar alunos por planilha
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Cada linha válida cria (ou reaproveita) o usuário e a matrícula na
        oferta de volume/turma indicada. Linhas com pré-requisito
        pendente, turma inexistente ou dados incompletos são reportadas
        sem interromper o restante do lote.
      </p>
      <div className="mt-4">
        <ImportStudentsForm />
      </div>
    </Card>
  );
}
