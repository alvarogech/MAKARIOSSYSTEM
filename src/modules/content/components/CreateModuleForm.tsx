"use client";

import { useActionState } from "react";
import { createModule, type CreateModuleState } from "../actions/createModule";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateModuleState = {};

export function CreateModuleForm({
  volumes,
}: {
  volumes: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createModule, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Módulo criado.</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="module-volumeId">Volume</Label>
          <select
            id="module-volumeId"
            name="volumeId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {volumes.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="module-name">Nome do módulo</Label>
          <Input id="module-name" name="name" required />
        </div>
        <div>
          <Label htmlFor="module-orderIndex">Posição</Label>
          <Input id="module-orderIndex" name="orderIndex" type="number" min={1} required />
        </div>
      </div>
      <Button type="submit" isLoading={isPending} className="self-start">
        Criar módulo
      </Button>
    </form>
  );
}
