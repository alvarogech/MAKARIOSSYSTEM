"use client";

import { useActionState } from "react";
import {
  submitClassReport,
  type SubmitClassReportState,
} from "../actions/submitClassReport";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: SubmitClassReportState = {};

export interface ExistingClassReport {
  contentCompleted: string;
  planChanged: boolean;
  planChangeNotes: string;
  recurringQuestions: string;
  occurrences: string;
  studentsNeedingAttention: string;
  observation: string;
}

export function ClassReportForm({
  meetingId,
  existing,
}: {
  meetingId: string;
  existing: ExistingClassReport | null;
}) {
  const [state, formAction, isPending] = useActionState(submitClassReport, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="meetingId" value={meetingId} />

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Relatório enviado à coordenação.</Alert> : null}

      <div>
        <Label htmlFor="contentCompleted">O que foi dado hoje?</Label>
        <textarea
          id="contentCompleted"
          name="contentCompleted"
          rows={3}
          placeholder="Em poucas linhas: o que você conseguiu ensinar e se mudou algo do plano."
          defaultValue={existing?.contentCompleted}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="studentsNeedingAttention">
          Algum aluno precisa de atenção? <span className="font-normal text-neutral-400">(opcional)</span>
        </Label>
        <textarea
          id="studentsNeedingAttention"
          name="studentsNeedingAttention"
          rows={2}
          placeholder="Nome e o que você notou."
          defaultValue={existing?.studentsNeedingAttention}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="observation">
          Ocorrências ou observações <span className="font-normal text-neutral-400">(opcional)</span>
        </Label>
        <textarea
          id="observation"
          name="observation"
          rows={2}
          placeholder="Algo da sala, do horário, de material ou dúvida que se repetiu."
          defaultValue={[existing?.occurrences, existing?.observation].filter(Boolean).join("\n\n")}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        {existing ? "Atualizar relatório" : "Enviar relatório"}
      </Button>
    </form>
  );
}
