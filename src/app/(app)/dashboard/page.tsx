import type { Metadata } from "next";
import { can, getAuthContext } from "@/authorization";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Card } from "@/components/ui/Card";
import { CreateInvitationForm } from "@/modules/auth/components/CreateInvitationForm";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage() {
  const authContext = await getAuthContext();

  // O layout de (app) já garante authContext/activeRole não-nulos aqui —
  // este `if` é só para o TypeScript, sem lógica de acesso duplicada.
  if (!authContext || !authContext.activeRole) {
    return null;
  }

  const canInvite = can(authContext, {
    resource: "invitations",
    action: "create",
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="text-xl font-semibold text-neutral-900">
          Olá, {authContext.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Você está navegando como{" "}
          <strong>{ROLE_LABELS[authContext.activeRole]}</strong>.
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Esta é a Fase 1 (Fundação) da Plataforma Makários: autenticação,
          perfis e permissões. Volumes, turmas, conteúdo, avaliações,
          frequência e certificados chegam nas próximas fases.
        </p>
      </Card>

      {canInvite ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">
            Convidar usuário
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Envia um convite por e-mail (Supabase Auth) e registra o perfil
            que será atribuído no primeiro acesso.
          </p>
          <div className="mt-4">
            <CreateInvitationForm />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
