"use client";

import { useActionState, type ReactNode } from "react";
import { reviewDeclarations, type DeclarationState } from "../actions/declarations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Seleção em lote: o conteúdo (linhas com checkbox name="ids") vem do servidor. */
export function DeclarationReviewForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState<DeclarationState, FormData>(reviewDeclarations, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Pronto — atualizado.</Alert> : null}
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="action" value="validate" size="sm" isLoading={pending}>
          Validar selecionadas
        </Button>
        <Button type="submit" name="action" value="revoke" size="sm" variant="secondary" disabled={pending}>
          Revogar selecionadas
        </Button>
        <Button type="submit" name="action" value="reopen" size="sm" variant="ghost" disabled={pending}>
          Reabrir para o aluno responder
        </Button>
      </div>
    </form>
  );
}
