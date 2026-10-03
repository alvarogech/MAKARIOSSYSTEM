"use client";

import { useActionState } from "react";
import { reviewContent, setActivityPublished, type ReviewContentState } from "../actions/reviewContent";
import { Button } from "@/components/ui/Button";
import { REVIEW_ACTION_RULES, type ReviewAction } from "../reviewWorkflow";

const initial: ReviewContentState = {};

export function ReviewActionButton({
  kind,
  action,
  ids,
  label,
  variant = "secondary",
}: {
  kind: "question" | "challenge";
  action: ReviewAction;
  ids: string[];
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [state, formAction, isPending] = useActionState(reviewContent, initial);

  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="action" value={action} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <Button type="submit" size="sm" variant={variant} isLoading={isPending}>
        {label ?? REVIEW_ACTION_RULES[action].label}
      </Button>
      {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      {state.error ? (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function ActivityPublishButton({
  activityId,
  mode,
  disabledReason,
}: {
  activityId: string;
  mode: "publish" | "unpublish";
  disabledReason?: string;
}) {
  const [state, formAction, isPending] = useActionState(setActivityPublished, initial);

  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="mode" value={mode} />
      <Button
        type="submit"
        size="sm"
        variant={mode === "publish" ? "primary" : "secondary"}
        isLoading={isPending}
        disabled={Boolean(disabledReason)}
        title={disabledReason}
      >
        {mode === "publish" ? "Publicar exercício" : "Tirar do ar"}
      </Button>
      {disabledReason ? <span className="text-xs text-neutral-500">{disabledReason}</span> : null}
      {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      {state.error ? (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
