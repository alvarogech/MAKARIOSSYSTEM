"use client";

// Erro ao confirmar a resposta, logo abaixo do botão: tentar de novo, ou recarregar se a falha for de rede.
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { ConfirmFailure } from "./runnerState";

export function ConfirmFailureNotice({
  failure,
  retrying,
  onRetry,
}: {
  failure: ConfirmFailure;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert variant="danger">
      <div className="min-w-0">
        <p>{failure.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="md" variant="secondary" isLoading={retrying} onClick={onRetry}>
          Tentar de novo
        </Button>
        {failure.canReload ? (
          <Button type="button" size="md" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
          ) : null}
        </div>
      </div>
    </Alert>
  );
}
