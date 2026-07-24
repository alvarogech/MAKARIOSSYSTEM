"use client";

import { useActionState } from "react";
import { publishAssessment, type PublishAssessmentState } from "../actions/publishAssessment";
import { releaseAnswerKey, type ReleaseAnswerKeyState } from "../actions/releaseAnswerKey";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const initialPublishState: PublishAssessmentState = {};
const initialReleaseState: ReleaseAnswerKeyState = {};

export function PublishAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const [state, formAction, isPending] = useActionState(publishAssessment, initialPublishState);

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <Button type="submit" variant="secondary" size="sm" isLoading={isPending}>
        Publicar
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}

export function ReleaseAnswerKeyButton({ assessmentId }: { assessmentId: string }) {
  const [state, formAction, isPending] = useActionState(releaseAnswerKey, initialReleaseState);

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <Button type="submit" variant="ghost" size="sm" isLoading={isPending}>
        Liberar gabarito
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
