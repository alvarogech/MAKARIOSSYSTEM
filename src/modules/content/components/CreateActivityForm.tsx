"use client";

import { useActionState } from "react";
import { createActivity, type CreateActivityState } from "../actions/createActivity";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateActivityState = {};

export function CreateActivityForm({
  lessons,
}: {
  lessons: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createActivity, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Exercício criado.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="act-lessonId">Aula</Label>
          <select
            id="act-lessonId"
            name="lessonId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="act-title">Título</Label>
          <Input id="act-title" name="title" required />
        </div>
      </div>

      <div>
        <Label htmlFor="act-instructions">Instruções (opcional)</Label>
        <Input id="act-instructions" name="instructions" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="act-maxAttempts">Tentativas (vazio = ilimitadas)</Label>
          <Input id="act-maxAttempts" name="maxAttempts" type="number" min={1} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-neutral-600">
          <input type="checkbox" name="blocksProgress" className="size-4 rounded border-neutral-300" />
          Bloqueia avanço até ser enviado
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-neutral-600">
          <input type="checkbox" name="showFeedbackAfterSubmit" defaultChecked className="size-4 rounded border-neutral-300" />
          Mostra correção após envio
        </label>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar exercício
      </Button>
    </form>
  );
}
