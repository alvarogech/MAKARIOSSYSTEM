"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { sendVolumeGroupEmails, type SendGroupEmailsState } from "../actions/sendGroupEmails";

export function SendGroupEmailsButton({
  volumeId,
  volumeName,
  pendingCount,
}: {
  volumeId: string;
  volumeName: string;
  pendingCount: number;
}) {
  const [state, formAction, isPending] = useActionState<SendGroupEmailsState, FormData>(sendVolumeGroupEmails, {});

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Envio real para os alunos: sempre pede confirmação antes.
        if (!window.confirm(`Enviar o link do grupo do ${volumeName} por e-mail para ${pendingCount} aluno(s)?`)) {
          event.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="volumeId" value={volumeId} />
      <Button type="submit" size="sm" isLoading={isPending} disabled={pendingCount === 0}>
        {pendingCount === 0 ? "Todos já receberam" : `Enviar para ${pendingCount} aluno(s)`}
      </Button>
      {state.success ? <span className="text-sm text-success">{state.success}</span> : null}
      {state.error ? (
        <span role="alert" className="text-sm text-danger">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
