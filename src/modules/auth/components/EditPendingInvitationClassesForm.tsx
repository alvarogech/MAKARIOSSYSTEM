"use client";

import { useActionState, useState } from "react";
import {
  updatePendingInvitationClasses,
  type UpdatePendingInvitationClassesState,
} from "../actions/updatePendingInvitationClasses";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const initialState: UpdatePendingInvitationClassesState = {};

export function EditPendingInvitationClassesForm({
  invitationId,
  classes,
  currentClassIds,
}: {
  invitationId: string;
  classes: { id: string; name: string }[];
  currentClassIds: string[];
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
        Editar turmas
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Turmas atualizadas.</Alert> : null}
      <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
        {classes.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="classIds"
              value={c.id}
              defaultChecked={currentClassIds.includes(c.id)}
              className="size-4 rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
            />
            {c.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
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
