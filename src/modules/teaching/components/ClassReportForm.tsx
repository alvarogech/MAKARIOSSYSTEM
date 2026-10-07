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
  attentionStudentIds: string[];
  studentsNeedingAttention: string;
  observation: string;
}

export interface ReportStudentOption {
  /** student_id quando a conta existe; senão o id da inscrição. */
  id: string;
  name: string;
}

const field =
  "w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

export function ClassReportForm({
  meetingId,
  students,
  existing,
}: {
  meetingId: string;
  students: ReportStudentOption[];
  existing: ExistingClassReport | null;
}) {
  const [state, formAction, isPending] = useActionState(submitClassReport, initialState);
  const selected = new Set(existing?.attentionStudentIds ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
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
          className={field}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-neutral-800">
          Algum aluno precisa de atenção? <span className="font-normal text-neutral-400">(opcional)</span>
        </legend>
        {students.length === 0 ? (
          <p className="text-sm text-neutral-500">Esta turma ainda não tem alunos na lista.</p>
        ) : (
          <ul className="max-h-56 overflow-y-auto rounded-[var(--radius-sm)] border border-neutral-200 bg-white">
            {students.map((student) => (
              <li key={student.id} className="border-b border-neutral-100 last:border-b-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    name="attentionStudentIds"
                    value={student.id}
                    defaultChecked={selected.has(student.id)}
                    className="size-4 accent-brand-blue"
                  />
                  {student.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <textarea
          id="studentsNeedingAttention"
          name="studentsNeedingAttention"
          rows={2}
          aria-label="Observação sobre os alunos marcados"
          placeholder="O que você notou nesses alunos (opcional)."
          defaultValue={existing?.studentsNeedingAttention}
          className={`${field} mt-2`}
        />
      </fieldset>

      <div>
        <Label htmlFor="observation">
          Ocorrências ou observações <span className="font-normal text-neutral-400">(opcional)</span>
        </Label>
        <textarea
          id="observation"
          name="observation"
          rows={2}
          placeholder="Algo da sala, do horário, de material ou dúvida que se repetiu."
          defaultValue={existing?.observation}
          className={field}
        />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        {existing ? "Atualizar relatório" : "Enviar relatório"}
      </Button>
    </form>
  );
}
