import type { Metadata } from "next";
import Link from "next/link";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatSaoPauloDateTime } from "@/lib/saoPauloDate";
import { ActivityPublishButton, ReviewActionButton } from "@/modules/content/components/ReviewControls";
import {
  availableActions,
  countByStatus,
  REVIEW_STATUS_LABELS,
  type ReviewStatus,
} from "@/modules/content/reviewWorkflow";

export const metadata: Metadata = { title: "Revisão de questões" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  in_review: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  published: "bg-brand-blue-light text-brand-blue-dark",
  archived: "bg-neutral-100 text-neutral-400",
};

function StatusBadge({ status }: { status: string }) {
  const known = status in REVIEW_STATUS_LABELS;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        known ? STATUS_STYLES[status as ReviewStatus] : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {known ? REVIEW_STATUS_LABELS[status as ReviewStatus] : status}
    </span>
  );
}

export default async function RevisaoPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!can(authContext, { resource: "question_bank", action: "manage" })) {
    return <AccessDenied description="Esta área é exclusiva de coordenação, administração e editor de conteúdo." />;
  }

  const canApprove = can(authContext, { resource: "question_bank", action: "approve" });
  const canPublish = can(authContext, { resource: "activities", action: "publish" });
  const supabase = await createSupabaseServerClient();

  const [{ data: volumes }, { data: modules }, { data: lessons }, { data: questions }, { data: activities }, { data: challenges }] =
    await Promise.all([
      supabase.from("volumes").select("id, name, order_index").order("order_index"),
      supabase.from("modules").select("id, volume_id, name, order_index").order("order_index"),
      supabase.from("lessons").select("id, module_id"),
      supabase
        .from("question_bank")
        .select(
          "id, external_ref, prompt, explanation, difficulty, selection_mode, status, lesson_id, module_id, volume_id, approved_by, approved_at, version",
        )
        .not("external_ref", "is", null)
        .order("external_ref"),
      supabase.from("activities").select("id, external_ref, title, status, lesson_id").not("external_ref", "is", null),
      supabase
        .from("practice_challenges")
        .select("id, external_ref, prompt, status, lesson_id, approved_by, approved_at")
        .not("external_ref", "is", null),
    ]);

  const questionIds = (questions ?? []).map((q) => q.id);
  const activityIds = (activities ?? []).map((a) => a.id);
  const approverIds = [
    ...new Set(
      [...(questions ?? []), ...(challenges ?? [])]
        .map((i) => i.approved_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: options }, { data: links }, { data: approvers }] = await Promise.all([
    questionIds.length
      ? supabase
          .from("question_options")
          .select("question_id, label, is_correct, order_index")
          .in("question_id", questionIds)
          .order("order_index")
      : Promise.resolve({ data: [] }),
    activityIds.length
      ? supabase.from("activity_questions").select("activity_id, question_id").in("activity_id", activityIds)
      : Promise.resolve({ data: [] }),
    approverIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", approverIds)
      : Promise.resolve({ data: [] }),
  ]);

  const approverName = new Map((approvers ?? []).map((p) => [p.id, p.full_name]));
  const optionsByQuestion = new Map<string, { label: string; is_correct: boolean }[]>();
  for (const option of options ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }
  const questionsByActivity = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = questionsByActivity.get(link.activity_id) ?? [];
    list.push(link.question_id);
    questionsByActivity.set(link.activity_id, list);
  }

  const lessonToModule = new Map((lessons ?? []).map((l) => [l.id, l.module_id]));
  const modulesWithContent = (modules ?? []).filter((m) =>
    (questions ?? []).some((q) => q.module_id === m.id),
  );

  function reviewedBy(item: { approved_by: string | null; approved_at: string | null }) {
    if (!item.approved_by || !item.approved_at) return null;
    return `Aprovada por ${approverName.get(item.approved_by) ?? "usuário"} em ${formatSaoPauloDateTime(item.approved_at)}`;
  }

  if (modulesWithContent.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-neutral-900">Revisão de questões</h1>
        <Card>
          <p className="text-sm text-neutral-500">Nenhum pacote de questões importado aguardando revisão.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Revisão de questões</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Pacotes importados entram como rascunho. Cada questão passa por <strong>rascunho → em revisão → aprovada</strong>;
            só depois o exercício da matéria pode ser publicado para as turmas. Quem aprova fica registrado, e questão
            aprovada não pode mais ser editada sem reabrir a revisão.
          </p>
        </div>
        <Link href="/conteudo/questoes" className={buttonVariants({ variant: "secondary" })}>
          Banco de questões
        </Link>
      </div>

      {!canApprove ? (
        <Card className="border-warning/30 bg-warning/5">
          <p className="text-sm text-neutral-700">
            Seu perfil pode enviar questões para revisão, mas <strong>aprovar e publicar</strong> é só da coordenação ou
            administração.
          </p>
        </Card>
      ) : null}

      {(volumes ?? []).map((volume) => {
        const volumeModules = modulesWithContent.filter((m) => m.volume_id === volume.id);
        if (volumeModules.length === 0) return null;

        return (
          <section key={volume.id} className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-neutral-900">{volume.name}</h2>

            {volumeModules.map((module_) => {
              const moduleQuestions = (questions ?? []).filter((q) => q.module_id === module_.id);
              const fixation = moduleQuestions.filter((q) => q.external_ref?.includes("-fix-"));
              const finals = moduleQuestions.filter((q) => q.external_ref?.includes("-final-"));
              const activity = (activities ?? []).find((a) => lessonToModule.get(a.lesson_id) === module_.id);
              const challenge = (challenges ?? []).find((c) => lessonToModule.get(c.lesson_id) === module_.id);
              const counts = countByStatus(moduleQuestions.map((q) => q.status));

              const activityQuestionStatuses = (questionsByActivity.get(activity?.id ?? "") ?? []).map(
                (id) => moduleQuestions.find((q) => q.id === id)?.status ?? "draft",
              );
              const allApproved =
                activityQuestionStatuses.length > 0 &&
                activityQuestionStatuses.every((s) => s === "approved" || s === "published");

              const idsIn = (list: typeof moduleQuestions, status: ReviewStatus) =>
                list.filter((q) => q.status === status).map((q) => q.id);

              return (
                <Card key={module_.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-neutral-900">{module_.name}</h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        {moduleQuestions.length} questões · {counts.draft} rascunho · {counts.in_review} em revisão ·{" "}
                        {counts.approved + counts.published} aprovadas
                      </p>
                    </div>
                  </div>

                  {activity ? (
                    <div className="mt-4 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-900">
                          {activity.title} <StatusBadge status={activity.status} />
                        </p>
                        {canPublish ? (
                          activity.status === "published" ? (
                            <ActivityPublishButton activityId={activity.id} mode="unpublish" />
                          ) : (
                            <ActivityPublishButton
                              activityId={activity.id}
                              mode="publish"
                              disabledReason={allApproved ? undefined : "Aprove as 5 questões de fixação para publicar."}
                            />
                          )
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Publicado, o exercício aparece para alunos matriculados nesta matéria. Não vale nota.
                      </p>
                    </div>
                  ) : null}

                  {challenge ? (
                    <div className="mt-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Desafio sem nota <StatusBadge status={challenge.status} />
                      </p>
                      <p className="mt-1 text-sm text-neutral-700">{challenge.prompt}</p>
                      {reviewedBy(challenge) ? <p className="mt-1 text-xs text-neutral-400">{reviewedBy(challenge)}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableActions(challenge.status as ReviewStatus, { canApprove, kind: "challenge" }).map((action) => (
                          <ReviewActionButton key={action} kind="challenge" action={action} ids={[challenge.id]} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {[
                    { title: "Exercício de fixação", list: fixation },
                    { title: "Avaliação final — reservada (não entra em nenhum exercício)", list: finals },
                  ].map((group) => (
                    <div key={group.title} className="mt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-neutral-800">
                          {group.title} ({group.list.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {idsIn(group.list, "draft").length > 0 ? (
                            <ReviewActionButton
                              kind="question"
                              action="submit_review"
                              ids={idsIn(group.list, "draft")}
                              label={`Enviar ${idsIn(group.list, "draft").length} para revisão`}
                            />
                          ) : null}
                          {canApprove && idsIn(group.list, "in_review").length > 0 ? (
                            <ReviewActionButton
                              kind="question"
                              action="approve"
                              variant="primary"
                              ids={idsIn(group.list, "in_review")}
                              label={`Aprovar ${idsIn(group.list, "in_review").length} em revisão`}
                            />
                          ) : null}
                        </div>
                      </div>

                      <ul className="mt-2 flex flex-col gap-2">
                        {group.list.map((q) => (
                          <li key={q.id} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3">
                            <details>
                              <summary className="cursor-pointer text-sm text-neutral-900">
                                <span className="mr-2 font-mono text-xs text-neutral-400">{q.external_ref}</span>
                                {q.prompt} <StatusBadge status={q.status} />
                                {q.selection_mode === "multiple" ? (
                                  <span className="ml-2 text-xs text-neutral-500">(marque as duas)</span>
                                ) : null}
                              </summary>
                              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                                {(optionsByQuestion.get(q.id) ?? []).map((option) => (
                                  <li
                                    key={option.label}
                                    className={`rounded-[var(--radius-sm)] border px-3 py-1.5 ${
                                      option.is_correct
                                        ? "border-success/40 bg-success/10 text-neutral-900"
                                        : "border-neutral-200 text-neutral-700"
                                    }`}
                                  >
                                    {option.label}
                                    {option.is_correct ? (
                                      <span className="ml-2 text-xs font-semibold text-success">✓ gabarito</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-3 whitespace-pre-line text-xs leading-5 text-neutral-500">{q.explanation}</p>
                              {reviewedBy(q) ? <p className="mt-2 text-xs text-neutral-400">{reviewedBy(q)} · versão {q.version}</p> : null}
                            </details>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {availableActions(q.status as ReviewStatus, { canApprove, kind: "question" }).map((action) => (
                                <ReviewActionButton key={action} kind="question" action={action} ids={[q.id]} />
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Card>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
