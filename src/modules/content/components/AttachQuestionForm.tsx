"use client";

import { useActionState } from "react";
import { attachQuestion, type AttachQuestionState } from "../actions/attachQuestion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: AttachQuestionState = {};

export function AttachQuestionForm({
  activities,
  questions,
}: {
  activities: { id: string; label: string }[];
  questions: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(attachQuestion, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Questão vinculada ao exercício.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="aq-activityId">Exercício</Label>
          <select
            id="aq-activityId"
            name="activityId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {activities.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="aq-questionId">Questão</Label>
          <select
            id="aq-questionId"
            name="questionId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {questions.map((q) => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="aq-orderIndex">Posição</Label>
          <Input id="aq-orderIndex" name="orderIndex" type="number" min={1} required />
        </div>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Vincular questão
      </Button>
    </form>
  );
}
