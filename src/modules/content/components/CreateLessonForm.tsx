"use client";

import { useActionState } from "react";
import { createLesson, type CreateLessonState } from "../actions/createLesson";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateLessonState = {};

export function CreateLessonForm({
  modules,
}: {
  modules: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createLesson, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Aula criada.</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="lesson-moduleId">Módulo</Label>
          <select
            id="lesson-moduleId"
            name="moduleId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="lesson-name">Nome da aula</Label>
          <Input id="lesson-name" name="name" required />
        </div>
        <div>
          <Label htmlFor="lesson-orderIndex">Posição</Label>
          <Input id="lesson-orderIndex" name="orderIndex" type="number" min={1} required />
        </div>
      </div>
      <div>
        <Label htmlFor="lesson-objectives">Objetivos (opcional)</Label>
        <Input id="lesson-objectives" name="objectives" />
      </div>
      <Button type="submit" isLoading={isPending} className="self-start">
        Criar aula
      </Button>
    </form>
  );
}
