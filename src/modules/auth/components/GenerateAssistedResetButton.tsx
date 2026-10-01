"use client";

import { useActionState } from "react";
import {
  generateAssistedPasswordReset,
  type GenerateAssistedPasswordResetState,
} from "../actions/generateAssistedPasswordReset";
import { buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CopyButton } from "@/components/ui/CopyButton";

const initialState: GenerateAssistedPasswordResetState = {};

export function GenerateAssistedResetButton({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(
    generateAssistedPasswordReset,
    initialState,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Gerar link de redefinição de senha
        </button>
      </form>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.result ? (
        <Alert variant="success">
          <div className="flex flex-col gap-2">
            <p>Link válido por 24 horas e uso único — copie e envie manualmente:</p>
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
