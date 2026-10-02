"use client";

import { useActionState, useState } from "react";
import {
  updatePendingInvitationClasses,
  type UpdatePendingInvitationClassesState,
} from "../actions/updatePendingInvitationClasses";
import type { AssignableLesson } from "../assignableLessons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const initialState: UpdatePendingInvitationClassesState = {};

function formatLessonDate(isoDate: string): string {
  if (!isoDate) return "";
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export function EditPendingInvitationClassesForm({
  invitationId,
  lessons,
  currentMeetingBlockIds,
}: {
  invitationId: string;
  lessons: AssignableLesson[];
  currentMeetingBlockIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updatePendingInvitationClasses,
    initialState,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Editar aulas
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Aulas atualizadas.</Alert> : null}
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {lessons.map((lesson) => (
          <label key={lesson.blockId} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="meetingBlockIds"
              value={lesson.blockId}
              defaultChecked={currentMeetingBlockIds.includes(lesson.blockId)}
              className="size-4 rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
            />
            {lesson.volumeName} — {lesson.className} — {formatLessonDate(lesson.meetingDate)} —{" "}
            {lesson.moduleName}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" isLoading={isPending}>
          Salvar
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Fechar
        </button>
      </div>
    </form>
  );
}
