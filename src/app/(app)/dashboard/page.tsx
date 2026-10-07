import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, MessageCircle } from "lucide-react";
import { can, canAccessArea, getAuthContext } from "@/authorization";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateInvitationForm } from "@/modules/auth/components/CreateInvitationForm";
import { loadStudentHomeSummary, type StudentHomeSummary } from "@/modules/learning/studentHome";
import { loadStudentAccess, summarize, type AccessSummary } from "@/modules/access/studentAccess";
import { FrequencyAlert, FrequencyMeter } from "@/modules/attendance/components/FrequencyPanel";
import { loadStudentFrequency, type VolumeFrequency } from "@/modules/attendance/studentFrequency";
import { loadDeclarationPrompts, type DeclarationPrompt } from "@/modules/attendance/declarations";
import { loadCoordinationAlerts, type CoordinationAlerts } from "@/modules/academic/coordinationAlerts";
import { DeclarationCard } from "@/modules/attendance/components/DeclarationCard";

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
  let frequency: VolumeFrequency[] = [];
  let declarationPrompts: DeclarationPrompt[] = [];
  if (authContext.activeRole === "student") {
    const supabase = await createSupabaseServerClient();
    studentSummary = await loadStudentHomeSummary(supabase, authContext.userId);
    frequency = await loadStudentFrequency(supabase, authContext.userId);
    declarationPrompts = await loadDeclarationPrompts(supabase, authContext.userId);
  }

  let accessSummary: AccessSummary | null = null;
  let alerts: CoordinationAlerts | null = null;
  if (canAccessCoordination) {
    const supabase = await createSupabaseServerClient();
    accessSummary = summarize(await loadStudentAccess(supabase));
    alerts = await loadCoordinationAlerts(supabase);
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

          {declarationPrompts
            .filter((prompt) => !prompt.declared)
            .map((prompt) => (
              <DeclarationCard key={prompt.meetingId} prompt={prompt} />
            ))}

          {frequency.map((volume) => (
            <Card key={volume.classId} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-neutral-900">Minha frequência · {volume.volumeName}</h2>
                <Link href="/minha-frequencia" className="text-sm font-medium text-brand-blue hover:underline">
                  Ver encontro por encontro →
                </Link>
              </div>
              {volume.progress.situation !== "em_dia" ? <FrequencyAlert view={volume} /> : null}
              <FrequencyMeter view={volume} />
            </Card>
          ))}

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
            {studentSummary.volumes.some((v) => v.whatsappGroupUrl) ? (
              <div className="mt-4 rounded-[var(--radius-sm)] border border-success/30 bg-success/5 p-3">
                <p className="text-sm font-medium text-neutral-900">Grupo de WhatsApp da sua turma</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {studentSummary.volumes
                    .filter((v) => v.whatsappGroupUrl)
                    .map((v) => (
                      <a
                        key={v.enrollmentId}
                        href={v.whatsappGroupUrl!}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                      >
                        <MessageCircle className="size-4" aria-hidden="true" />
                        Entrar no grupo — {v.volumeName}
                      </a>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
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
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/professor" className={buttonVariants({ variant: "primary" })}>
              Minhas turmas e agenda
            </Link>
          </div>
        </Card>
      ) : null}

      {alerts && (alerts.withoutTeacher.length > 0 || alerts.reportsMissing > 0 || alerts.dataIssues > 0) ? (
        <Card className="border-warning/30 bg-warning/5">
          <h2 className="text-lg font-semibold text-neutral-900">Pede atenção</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-neutral-800">
            {alerts.withoutTeacher.length > 0 ? (
              <li>
                <p className="font-medium">
                  {alerts.withoutTeacher.length} aula(s) sem professor atribuído (últimas e próximas 2 semanas)
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-neutral-600">
                  {alerts.withoutTeacher.slice(0, 6).map((m) => (
                    <li key={m.meetingId}>
                      <Link href={`/coordenacao/turmas/${m.classId}/escala`} className="text-brand-blue hover:underline">
                        {m.className} · encontro {m.sequence} · {m.date.split("-").reverse().slice(0, 2).join("/")}
                      </Link>
                      {m.past ? <span className="ml-1 font-medium text-danger">(já passou)</span> : null}
                    </li>
                  ))}
                  {alerts.withoutTeacher.length > 6 ? <li>… e mais {alerts.withoutTeacher.length - 6}</li> : null}
                </ul>
              </li>
            ) : null}
            {alerts.reportsMissing > 0 ? (
              <li>
                <Link href="/coordenacao/relatorios" className="font-medium text-brand-blue hover:underline">
                  {alerts.reportsMissing} encontro(s) já realizados sem relatório pós-aula →
                </Link>
              </li>
            ) : null}
            {alerts.dataIssues > 0 ? (
              <li>
                <Link href="/coordenacao/qualidade-dados" className="font-medium text-brand-blue hover:underline">
                  {alerts.dataIssues} item(ns) de dados para revisar (contas ou convites duplicados, WhatsApp incompleto) →
                </Link>
              </li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {accessSummary && accessSummary.approved > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Acesso dos alunos</h2>
            <Link href="/coordenacao/acessos" className="text-sm font-medium text-brand-blue hover:underline">
              Ver quem ainda não acessou →
            </Link>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Aprovados", value: accessSummary.approved },
              { label: "Criaram a conta", value: accessSummary.withAccount },
              { label: "Já entraram", value: accessSummary.loggedIn },
              { label: "Abriram material", value: accessSummary.openedMaterial },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{item.label}</dt>
                <dd className="text-2xl font-semibold text-neutral-900">{item.value}</dd>
                <dd className="text-xs text-neutral-500">
                  {Math.round((item.value / accessSummary.approved) * 100)}% dos aprovados
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {canAccessCoordination ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Coordenação</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Temporadas, ofertas de volume, turmas, matrículas e importação de alunos.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/coordenacao" className={buttonVariants({ variant: "primary" })}>
              Área da coordenação
            </Link>
          </div>
        </Card>
      ) : null}

      {canManageContent ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Conteúdo</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/conteudo" className={buttonVariants({ variant: "primary" })}>
              Estúdio de conteúdo
            </Link>
            <Link href="/conteudo/questoes" className={buttonVariants({ variant: "secondary" })}>
              Banco de questões
            </Link>
            <Link href="/conteudo/avaliacoes" className={buttonVariants({ variant: "secondary" })}>
              Avaliações
            </Link>
            <Link href="/conteudo/revisao" className={buttonVariants({ variant: "secondary" })}>
              Revisão de questões
            </Link>
          </div>
        </Card>
      ) : null}

      {canAccessAdmin ? (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Administração</h2>
          <div className="mt-3 flex flex-wrap gap-3">
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
