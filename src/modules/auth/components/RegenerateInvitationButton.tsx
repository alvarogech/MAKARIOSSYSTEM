"use client";

import { useActionState } from "react";
import {
  regenerateTeacherInvitation,
  type RegenerateTeacherInvitationState,
} from "../actions/regenerateTeacherInvitation";
import { buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CopyButton } from "@/components/ui/CopyButton";

const initialState: RegenerateTeacherInvitationState = {};

export function RegenerateInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, formAction, isPending] = useActionState(
    regenerateTeacherInvitation,
    initialState,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="invitationId" value={invitationId} />
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Gerar novo convite
        </button>
      </form>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.result ? (
        <Alert variant="success">
          <div className="flex flex-col gap-2">
            <p>Novo link gerado — o anterior foi invalidado. Copie agora:</p>
            <p className="break-all rounded bg-white/60 p-2 text-xs text-neutral-700">
              {state.result.link}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={state.result.link} label="link" />
              <CopyButton value={state.result.whatsappMessage} label="mensagem para WhatsApp" />
            </div>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}
