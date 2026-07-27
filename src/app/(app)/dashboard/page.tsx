import type { Metadata } from "next";
import Link from "next/link";
import { can, canAccessArea, getAuthContext } from "@/authorization";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
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
  const canManageContent = can(authContext, { resource: "content", action: "manage" });
  const canAccessCoordination = canAccessArea(authContext, "coordination");
  const canAccessTeacherArea = canAccessArea(authContext, "teacher");
  const canAccessAdmin = canAccessArea(authContext, "admin");

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
          Fase 3 da Plataforma Makários: conteúdo, vídeos, exercícios e
          progresso do aluno. Frequência, avaliações formais, reposições e
          certificados chegam nas próximas fases.
        </p>
      </Card>

      {authContext.activeRole === "student" ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Meus estudos</h2>
          <div className="mt-3 flex gap-3">
            <Link href="/meus-volumes" className={buttonVariants({ variant: "primary" })}>
              Meus volumes
            </Link>
            <Link href="/agenda" className={buttonVariants({ variant: "secondary" })}>
              Agenda
            </Link>
          </div>
        </Card>
      ) : null}

      {canAccessTeacherArea ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Área do professor</h2>
          <div className="mt-3 flex gap-3">
            <Link href="/professor" className={buttonVariants({ variant: "primary" })}>
              Minhas turmas e agenda
            </Link>
          </div>
        </Card>
      ) : null}

      {canAccessCoordination ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Coordenação</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Temporadas, ofertas de volume, turmas, matrículas e importação de alunos.
          </p>
          <div className="mt-3 flex gap-3">
            <Link href="/coordenacao" className={buttonVariants({ variant: "primary" })}>
              Área da coordenação
            </Link>
          </div>
        </Card>
      ) : null}

      {canManageContent ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Conteúdo</h2>
          <div className="mt-3 flex gap-3">
            <Link href="/conteudo" className={buttonVariants({ variant: "primary" })}>
              Estúdio de conteúdo
            </Link>
            <Link href="/conteudo/questoes" className={buttonVariants({ variant: "secondary" })}>
              Banco de questões
            </Link>
            <Link href="/conteudo/avaliacoes" className={buttonVariants({ variant: "secondary" })}>
              Avaliações
            </Link>
          </div>
        </Card>
      ) : null}

      {canAccessAdmin ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Administração</h2>
          <div className="mt-3 flex gap-3">
            <Link href="/administracao" className={buttonVariants({ variant: "primary" })}>
              Área administrativa
            </Link>
          </div>
        </Card>
      ) : null}

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
