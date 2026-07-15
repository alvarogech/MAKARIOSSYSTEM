import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Administração" };

export default async function AdministracaoAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "admin")) {
    return (
      <AccessDenied description="Esta área é exclusiva do perfil Administrador." />
    );
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold text-neutral-900">Administração</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Gestão de usuários, perfis, permissões e auditoria completa chegam
        nas próximas fases. Esta página existe nesta fase só para
        comprovar que a checagem de área funciona numa rota real.
      </p>
    </Card>
  );
}
