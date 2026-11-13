"use client";

// O aluno que não fez a avaliação final pede a liberação, escrevendo o motivo. Depois de enviar, cai na preparação da prova.
import { useActionState } from "react";
import { requestLateRelease, type RequestLateReleaseState } from "../actions/requestLateRelease";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: RequestLateReleaseState = {};

export function RequestLateReleaseForm({
  assessmentId,
  questionsCount,
  durationMinutes,
}: {
  assessmentId: string;
  questionsCount: number;
  durationMinutes: number;
}) {
  const [state, formAction, isPending] = useActionState(requestLateRelease, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Não conseguiu fazer a avaliação final?</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Conte o motivo e a prova é liberada para você na hora, sem precisar falar com ninguém.
        </p>
      </div>

      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div>
        <Label htmlFor="late-reason">Por que você não conseguiu fazer?</Label>
        <textarea
          id="late-reason"
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={4}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-3 text-base focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <p className="mt-1 text-xs text-neutral-500">De 10 a 500 letras.</p>
      </div>

      <Alert variant="warning">
        Depois de enviar, você tem 24 horas para fazer. São {questionsCount} questões e {durationMinutes} minutos a partir
        do início. Envie só quando puder fazer.
      </Alert>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Button type="submit" size="lg" isLoading={isPending} className="w-full sm:w-auto sm:self-start">
        Enviar e liberar minha prova
      </Button>
    </form>
  );
}
