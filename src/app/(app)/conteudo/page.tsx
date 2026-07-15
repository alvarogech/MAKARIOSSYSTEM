import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Estúdio de conteúdo" };

export default async function ConteudoAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "content_editor")) {
    return (
      <AccessDenied description="Esta área é exclusiva do perfil Editor de conteúdo." />
    );
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold text-neutral-900">
        Estúdio de conteúdo
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Módulos, aulas, banco de questões e avaliações chegam na Fase 3+.
        Esta página existe nesta fase só para comprovar que a checagem de
        área funciona numa rota real.
      </p>
    </Card>
  );
}
