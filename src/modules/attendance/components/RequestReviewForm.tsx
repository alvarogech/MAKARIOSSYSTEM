"use client";

import { useActionState, type ReactNode } from "react";
import { decideAttendanceRequests, type RequestState } from "../actions/requests";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Decisão em lote (aprovar, recusar ou reabrir) com observação opcional; as linhas com checkbox name="ids" vêm do servidor. */
export function RequestReviewForm({ children, canDecide }: { children: ReactNode; canDecide: boolean }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(decideAttendanceRequests, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      {children}
      {canDecide ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <label htmlFor="decision-note" className="text-xs font-medium text-neutral-600">
            Observação para o aluno (opcional — o aluno vê, principalmente quando você recusa)
          </label>
          <input
            id="decision-note"
            name="note"
            maxLength={500}
            className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="Ex.: Confirmei com o professor / Não há registro de você nessa aula."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="decision" value="approved" size="sm" isLoading={pending}>
              Aprovar selecionados
            </Button>
            <Button type="submit" name="decision" value="rejected" size="sm" variant="secondary" disabled={pending}>
              Recusar selecionados
            </Button>
            <Button type="submit" name="decision" value="reopen" size="sm" variant="ghost" disabled={pending}>
              Voltar para análise
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Só o administrador aprova ou recusa. Você pode acompanhar os pedidos aqui.</p>
      )}
    </form>
  );
}
