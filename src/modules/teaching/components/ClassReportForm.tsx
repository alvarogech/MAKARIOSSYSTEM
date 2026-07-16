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
        <Label htmlFor="contentCompleted">Conteúdo concluído</Label>
        <textarea
          id="contentCompleted"
          name="contentCompleted"
          rows={2}
          defaultValue={existing?.contentCompleted}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          name="planChanged"
          defaultChecked={existing?.planChanged}
          className="size-4 rounded border-neutral-300"
        />
        Houve alteração no plano de aula
      </label>

      <div>
        <Label htmlFor="planChangeNotes">Detalhes da alteração (se houver)</Label>
        <textarea
          id="planChangeNotes"
          name="planChangeNotes"
          rows={2}
          defaultValue={existing?.planChangeNotes}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="recurringQuestions">Dúvidas recorrentes</Label>
        <textarea
          id="recurringQuestions"
          name="recurringQuestions"
          rows={2}
          defaultValue={existing?.recurringQuestions}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="occurrences">Ocorrências</Label>
        <textarea
          id="occurrences"
          name="occurrences"
          rows={2}
          defaultValue={existing?.occurrences}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="studentsNeedingAttention">Alunos que precisam de atenção</Label>
        <textarea
          id="studentsNeedingAttention"
          name="studentsNeedingAttention"
          rows={2}
          defaultValue={existing?.studentsNeedingAttention}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="observation">Observações gerais</Label>
        <textarea
          id="observation"
          name="observation"
          rows={2}
          defaultValue={existing?.observation}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        {existing ? "Atualizar relatório" : "Enviar relatório"}
      </Button>
    </form>
  );
}
