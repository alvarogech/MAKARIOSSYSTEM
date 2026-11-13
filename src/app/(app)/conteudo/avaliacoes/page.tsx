import type { Metadata } from "next";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateAssessmentForm } from "@/modules/assessment/components/CreateAssessmentForm";
import { AddQuestionToAssessmentForm } from "@/modules/assessment/components/AddQuestionToAssessmentForm";
import { AddRecoveryPathItemForm } from "@/modules/assessment/components/AddRecoveryPathItemForm";
import {
  PublishAssessmentButton,
  ReleaseAnswerKeyButton,
} from "@/modules/assessment/components/AssessmentActionButtons";
import { GrantExceptionalAttemptForm } from "@/modules/assessment/components/GrantExceptionalAttemptForm";
import { GrantLateReleaseForm } from "@/modules/assessment/components/GrantLateReleaseForm";
import { LateRequestsWindowForm } from "@/modules/assessment/components/LateRequestsWindowForm";
import { LateReleasesList } from "@/modules/assessment/components/LateReleasesList";
import { loadLateReleaseRows } from "@/modules/assessment/lateReleaseRows";
import { formatReleaseDeadline, isPastDeadline, toBrasiliaInputValue } from "@/modules/assessment/lateRelease";
import { statusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Avaliações" };

export default async function AvaliacoesPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!can(authContext, { resource: "assessments", action: "manage" })) {
    return (
      <AccessDenied description="Esta área é exclusiva de coordenação, administração e editor de conteúdo." />
    );
  }

  const canPublish = can(authContext, { resource: "assessments", action: "publish" });
  const canReleaseKey = can(authContext, { resource: "assessments", action: "release_answer_key" });
  const canGrantExceptional = can(authContext, {
    resource: "assessments",
    action: "grant_exceptional_attempt",
  });

  const supabase = await createSupabaseServerClient();
  const lateReleaseRows = canGrantExceptional ? await loadLateReleaseRows(supabase) : [];

  const [
    { data: offerings },
    { data: volumes },
    { data: seasons },
    { data: assessments },
    { data: questions },
    { data: contents },
    { data: activities },
  ] = await Promise.all([
    supabase.from("season_volume_offerings").select("id, season_id, volume_id"),
    supabase.from("volumes").select("id, name"),
    supabase.from("seasons").select("id, name"),
    supabase
      .from("assessments")
      .select("id, title, type, season_volume_offering_id, status, questions_count, duration_minutes, answer_key_released_at, closes_at, late_requests_until")
      .order("created_at", { ascending: false }),
    supabase.from("question_bank").select("id, prompt").order("created_at", { ascending: false }),
    supabase.from("contents").select("id, title"),
    supabase.from("activities").select("id, title"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const seasonsById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const offeringLabel = (offeringId: string) => {
    const offering = (offerings ?? []).find((o) => o.id === offeringId);
    if (!offering) return "Oferta";
    const volume = volumesById.get(offering.volume_id)?.name ?? "Volume";
    const season = seasonsById.get(offering.season_id)?.name ?? "Temporada";
    return `${volume} — ${season}`;
  };

  const finalAssessments = (assessments ?? []).filter((a) => a.type === "final");
  const recoveryAssessments = (assessments ?? []).filter((a) => a.type === "recovery");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Avaliações</h1>
        <p className="mt-1 text-sm text-neutral-500">
          20 questões, 60 minutos, 14 dias de janela e nota mínima 6 são
          os valores padrão (docs 02/08) — ajustáveis por avaliação.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Nova avaliação</h2>
        <div className="mt-3">
          <CreateAssessmentForm
            offerings={(offerings ?? []).map((o) => ({ id: o.id, label: offeringLabel(o.id) }))}
            finalAssessments={finalAssessments.map((a) => ({
              id: a.id,
              label: `${a.title} — ${offeringLabel(a.season_volume_offering_id)}`,
            }))}
          />
        </div>

        <ul className="mt-6 divide-y divide-neutral-100 text-sm">
          {(assessments ?? []).map((a) => (
            <li key={a.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-neutral-700">
                  <span className="font-medium">{a.title}</span> —{" "}
                  {offeringLabel(a.season_volume_offering_id)}{" "}
                  <span className="text-neutral-400">
                    ({a.type === "final" ? "final" : "recuperação"}, {a.questions_count}q,{" "}
                    {a.duration_minutes}min, {statusLabel(a.status).toLowerCase()}
                    {a.answer_key_released_at ? ", gabarito liberado" : ""})
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {canPublish && a.status === "draft" ? (
                    <PublishAssessmentButton assessmentId={a.id} />
                  ) : null}
                  {canReleaseKey && a.status === "open" && !a.answer_key_released_at ? (
                    <ReleaseAnswerKeyButton assessmentId={a.id} />
                  ) : null}
                </div>
              </div>
              {canGrantExceptional && a.status === "open" && isPastDeadline(a.closes_at) ? (
                <LateRequestsWindowForm
                  assessmentId={a.id}
                  currentLabel={
                    a.late_requests_until
                      ? `Pedidos de liberação ${new Date(a.late_requests_until) > new Date() ? "abertos" : "encerrados"} até ${formatReleaseDeadline(a.late_requests_until)}`
                      : "Pedidos de liberação desligados"
                  }
                  currentValue={a.late_requests_until ? toBrasiliaInputValue(a.late_requests_until) : ""}
                />
              ) : null}
            </li>
          ))}
          {(assessments ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhuma avaliação criada ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Adicionar questão a uma avaliação</h2>
        <div className="mt-3">
          <AddQuestionToAssessmentForm
            assessments={(assessments ?? []).map((a) => ({
              id: a.id,
              label: `${a.title} — ${offeringLabel(a.season_volume_offering_id)}`,
            }))}
            questions={(questions ?? []).map((q) => ({ id: q.id, label: q.prompt }))}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Trilha de revisão da recuperação</h2>
        <p className="mt-1 text-sm text-neutral-500">
          O aluno só pode tentar a recuperação depois de concluir todos os itens.
        </p>
        <div className="mt-3">
          <AddRecoveryPathItemForm
            recoveryAssessments={recoveryAssessments.map((a) => ({
              id: a.id,
              label: `${a.title} — ${offeringLabel(a.season_volume_offering_id)}`,
            }))}
            contents={(contents ?? []).map((c) => ({ id: c.id, label: c.title }))}
            activities={(activities ?? []).map((act) => ({ id: act.id, label: act.title }))}
          />
        </div>
      </Card>

      {canGrantExceptional ? (
        <Card>
          <h2 className="font-semibold text-neutral-900">Tentativa excepcional</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Sempre manual e justificada — fica registrada na auditoria.
          </p>
          <div className="mt-3">
            <GrantExceptionalAttemptForm
              assessments={(assessments ?? []).map((a) => ({
                id: a.id,
                label: `${a.title} — ${offeringLabel(a.season_volume_offering_id)}`,
              }))}
            />
          </div>
        </Card>
      ) : null}

      {canGrantExceptional ? (
        <Card>
          <h2 className="font-semibold text-neutral-900">Liberações fora do prazo</h2>
          <p className="mt-1 text-sm text-neutral-500">
            O aluno mesmo pode pedir pela plataforma, escrevendo o motivo, enquanto a data de pedidos (em cada avaliação, acima) estiver
            aberta. Aqui a coordenação libera ou renova por 24 horas para um aluno que procurou a escola. Vale também para quem nunca abriu
            a prova e não dá tentativa extra. Tudo fica registrado na auditoria.
          </p>
          <div className="mt-3">
            <GrantLateReleaseForm
              assessments={finalAssessments.concat(recoveryAssessments).map((a) => ({
                id: a.id,
                label: `${a.title} · ${offeringLabel(a.season_volume_offering_id)}`,
              }))}
            />
          </div>
          <h3 className="mt-5 text-sm font-semibold text-neutral-900">Quem foi liberado</h3>
          <div className="mt-2">
            <LateReleasesList
              rows={lateReleaseRows}
              assessmentLabelById={Object.fromEntries(
                (assessments ?? []).map((a) => [a.id, `${a.title} · ${offeringLabel(a.season_volume_offering_id)}`]),
              )}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
