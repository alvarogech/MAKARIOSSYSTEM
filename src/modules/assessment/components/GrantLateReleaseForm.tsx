"use client";

// Formulário "Liberar prova por 24 horas": aluno por e-mail (serve também para quem nunca abriu a prova).
import { useActionState } from "react";
import { grantLateRelease, type GrantLateReleaseState } from "../actions/grantLateRelease";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: GrantLateReleaseState = {};

export function GrantLateReleaseForm({ assessments }: { assessments: { id: string; label: string }[] }) {
  const [state, formAction, isPending] = useActionState(grantLateRelease, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="lr-assessmentId">Avaliação</Label>
          <select
            id="lr-assessmentId"
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
          <Label htmlFor="lr-studentEmail">E-mail do aluno</Label>
          <Input id="lr-studentEmail" name="studentEmail" type="email" inputMode="email" autoComplete="off" required />
        </div>
      </div>

      <div>
        <Label htmlFor="lr-reason">Motivo</Label>
        <textarea
          id="lr-reason"
          name="reason"
          required
          minLength={10}
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" isLoading={isPending} className="w-full sm:w-auto sm:self-start">
        Liberar prova por 24 horas
      </Button>
    </form>
  );
}
