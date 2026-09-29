import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { can, canAccessArea, getAuthContext } from "@/authorization";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateInvitationForm } from "@/modules/auth/components/CreateInvitationForm";
import { loadStudentHomeSummary, type StudentHomeSummary } from "@/modules/learning/studentHome";

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

  let studentSummary: StudentHomeSummary | null = null;
  if (authContext.activeRole === "student") {
    const supabase = await createSupabaseServerClient();
    studentSummary = await loadStudentHomeSummary(supabase, authContext.userId);
  }

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

      {authContext.activeRole === "student" && studentSummary ? (
        <>
          {studentSummary.nextMeeting ? (
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                    Próximo encontro
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-neutral-900">
                    {studentSummary.nextMeeting.volumeName} · {studentSummary.nextMeeting.className}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {studentSummary.nextMeeting.dateLabel}
                    {studentSummary.nextMeeting.timeLabel ? ` · ${studentSummary.nextMeeting.timeLabel}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    {studentSummary.nextMeeting.location ?? "Local a confirmar"}
                  </p>
                  {studentSummary.otherUpcomingCount > 0 ? (
                    <p className="mt-2 text-xs text-neutral-400">
                      +{studentSummary.otherUpcomingCount} outro(s) encontro(s) agendado(s) — veja na Agenda
                    </p>
                  ) : null}
                </div>
                <Calendar className="size-8 shrink-0 text-brand-blue" aria-hidden="true" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {studentSummary.nextMeeting.mapsUrl ? (
                  <a
                    href={studentSummary.nextMeeting.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Abrir rota
                  </a>
                ) : null}
                <Link
                  href={studentSummary.nextMeeting.volumeHref}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Ver detalhes
                </Link>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Próximo encontro
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Nenhum encontro agendado no momento — a coordenação ainda não programou a próxima data.
              </p>
            </Card>
          )}

          {studentSummary.nextStep ? (
            <Card className="border-brand-blue/30 bg-brand-blue-light">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                Meu próximo passo
              </p>
              <p className="mt-1.5 text-sm font-medium text-neutral-900">{studentSummary.nextStep.label}</p>
              {studentSummary.nextStep.href ? (
                <Link
                  href={studentSummary.nextStep.href}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline"
                >
                  Continuar <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">Meus volumes</h2>
              {studentSummary.volumes.length > 0 ? (
                <Link href="/meus-volumes" className="text-sm text-brand-blue hover:underline">
                  Ver todos
                </Link>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {studentSummary.volumes.slice(0, 4).map((volume) => (
                <Link key={volume.enrollmentId} href={`/meus-volumes/${volume.enrollmentId}`}>
                  <div className="h-full rounded-[var(--radius-sm)] border border-neutral-200 p-4 transition-colors hover:border-brand-blue">
                    <p className="font-medium text-neutral-900">{volume.volumeName}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{volume.seasonName}</p>
                    <p className="mt-1.5 text-xs font-medium text-brand-blue">
                      {ENROLLMENT_STATUS_LABELS[volume.status] ?? volume.status}
                    </p>
                  </div>
                </Link>
              ))}
              {studentSummary.volumes.length === 0 ? (
                <p className="text-sm text-neutral-400">Nenhuma matrícula encontrada ainda.</p>
              ) : null}
            </div>
            <div className="mt-4 flex gap-3">
              <Link href="/meus-volumes" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Meus volumes
              </Link>
              <Link href="/agenda" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Agenda
              </Link>
            </div>
          </Card>
        </>
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
