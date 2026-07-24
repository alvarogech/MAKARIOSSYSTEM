"use client";

import { useActionState } from "react";
import {
  grantExceptionalAttempt,
  type GrantExceptionalAttemptState,
} from "../actions/grantExceptionalAttempt";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: GrantExceptionalAttemptState = {};

export function GrantExceptionalAttemptForm({
  assessments,
}: {
  assessments: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    grantExceptionalAttempt,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Tentativa excepcional concedida e auditada.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ex-assessmentId">Avaliação</Label>
          <select
            id="ex-assessmentId"
            name="assessmentId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ex-studentEmail">E-mail do aluno</Label>
          <Input id="ex-studentEmail" name="studentEmail" type="email" required />
        </div>
      </div>

      <div>
        <Label htmlFor="ex-justification">Justificativa</Label>
        <textarea
          id="ex-justification"
          name="justification"
          required
          minLength={10}
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Conceder tentativa excepcional
      </Button>
    </form>
  );
}
