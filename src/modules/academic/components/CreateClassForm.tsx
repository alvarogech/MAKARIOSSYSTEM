"use client";

import { useActionState } from "react";
import { createClass, type CreateClassState } from "../actions/createClass";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateClassState = {};

export function CreateClassForm({
  offerings,
  templates,
}: {
  offerings: { id: string; label: string }[];
  templates: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createClass,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success">
          Turma criada com os encontros já gerados a partir do modelo de
          horário.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="seasonVolumeOfferingId">Oferta de volume</Label>
          <select
            id="seasonVolumeOfferingId"
            name="seasonVolumeOfferingId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="classTemplateId">Modelo de horário</Label>
          <select
            id="classTemplateId"
            name="classTemplateId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Nome da turma</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="capacity">Capacidade (opcional)</Label>
          <Input id="capacity" name="capacity" type="number" min={1} />
        </div>
      </div>

      <div>
        <Label htmlFor="location">Local (opcional)</Label>
        <Input id="location" name="location" />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar turma
      </Button>
    </form>
  );
}
