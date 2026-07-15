"use client";

import { useActionState } from "react";
import { createSeason, type CreateSeasonState } from "../actions/createSeason";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateSeasonState = {};

export function CreateSeasonForm() {
  const [state, formAction, isPending] = useActionState(
    createSeason,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success">Temporada criada.</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="name">Nome (ex.: 2026.2)</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="startsOn">Início (opcional)</Label>
          <Input id="startsOn" name="startsOn" type="date" />
        </div>
        <div>
          <Label htmlFor="endsOn">Fim (opcional)</Label>
          <Input id="endsOn" name="endsOn" type="date" />
        </div>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar temporada
      </Button>
    </form>
  );
}
