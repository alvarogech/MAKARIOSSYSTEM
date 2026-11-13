"use client";

// Coordenação: até quando a avaliação aceita pedido de liberação do aluno (ligar, mudar ou desligar).
import { useActionState } from "react";
import { setLateRequestsWindow, type SetLateRequestsWindowState } from "../actions/setLateRequestsWindow";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const initialState: SetLateRequestsWindowState = {};

export function LateRequestsWindowForm({
  assessmentId,
  currentLabel,
  currentValue,
}: {
  assessmentId: string;
  /** Texto do estado atual, por exemplo "Pedidos abertos até 13/11 às 23:59" ou "Pedidos desligados". */
  currentLabel: string;
  /** Valor atual no formato do campo (AAAA-MM-DDTHH:mm, Brasília), vazio quando desligado. */
  currentValue: string;
}) {
  const [state, formAction, isPending] = useActionState(setLateRequestsWindow, initialState);
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3" noValidate>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <p className="text-xs font-medium text-neutral-700">{currentLabel}</p>
      <label className="text-xs text-neutral-600" htmlFor={`until-${assessmentId}`}>
        Aceitar pedidos de liberação até (horário de Brasília)
      </label>
      <input
        id={`until-${assessmentId}`}
        name="until"
        type="datetime-local"
        defaultValue={currentValue}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue sm:max-w-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="save" size="md" variant="secondary" disabled={isPending}>
          Salvar data
        </Button>
        <Button type="submit" name="intent" value="off" size="md" variant="ghost" disabled={isPending}>
          Desligar pedidos
        </Button>
      </div>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
    </form>
  );
}
