"use client";

import { useActionState } from "react";
import {
  revokeTeacherInvitation,
  type RevokeTeacherInvitationState,
} from "../actions/revokeTeacherInvitation";
import { buttonVariants } from "@/components/ui/Button";

const initialState: RevokeTeacherInvitationState = {};

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, formAction, isPending] = useActionState(revokeTeacherInvitation, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={isPending}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Revogar
      </button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
