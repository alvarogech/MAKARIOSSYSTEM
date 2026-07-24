"use client";

import { useActionState, useState } from "react";
import { createAssessment, type CreateAssessmentState } from "../actions/createAssessment";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateAssessmentState = {};

export function CreateAssessmentForm({
  offerings,
  finalAssessments,
}: {
  offerings: { id: string; label: string }[];
  finalAssessments: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createAssessment, initialState);
  const [type, setType] = useState("final");

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Avaliação criada como rascunho.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="a-offeringId">Oferta de volume</Label>
          <select
            id="a-offeringId"
            name="seasonVolumeOfferingId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="a-type">Tipo</Label>
          <select
            id="a-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="final">Avaliação final</option>
            <option value="recovery">Recuperação</option>
          </select>
        </div>
      </div>

      {type === "recovery" ? (
        <div>
          <Label htmlFor="a-linkedAssessmentId">Avaliação regular vinculada</Label>
          <select
            id="a-linkedAssessmentId"
            name="linkedAssessmentId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {finalAssessments.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            As questões da recuperação precisam ser diferentes das dessa avaliação.
          </p>
        </div>
      ) : null}

      <div>
        <Label htmlFor="a-title">Título</Label>
        <Input id="a-title" name="title" required />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="a-questionsCount">Questões</Label>
          <Input id="a-questionsCount" name="questionsCount" type="number" min={1} defaultValue={20} />
        </div>
        <div>
          <Label htmlFor="a-durationMinutes">Minutos</Label>
          <Input id="a-durationMinutes" name="durationMinutes" type="number" min={1} defaultValue={60} />
        </div>
        <div>
          <Label htmlFor="a-windowDays">Dias de janela</Label>
          <Input id="a-windowDays" name="windowDays" type="number" min={1} defaultValue={14} />
        </div>
        <div>
          <Label htmlFor="a-passingGrade">Nota mínima</Label>
          <Input id="a-passingGrade" name="passingGrade" type="number" step="0.1" min={0} max={10} defaultValue={6} />
        </div>
      </div>

      <div>
        <Label htmlFor="a-opensAt">Abertura (opcional — pode publicar sem, e ajustar depois)</Label>
        <Input id="a-opensAt" name="opensAt" type="datetime-local" />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar avaliação
      </Button>
    </form>
  );
}
