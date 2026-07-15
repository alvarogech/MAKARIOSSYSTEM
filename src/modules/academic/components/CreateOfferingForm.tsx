"use client";

import { useActionState } from "react";
import {
  createOffering,
  type CreateOfferingState,
} from "../actions/createOffering";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateOfferingState = {};

export function CreateOfferingForm({
  seasons,
  volumes,
}: {
  seasons: { id: string; name: string }[];
  volumes: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createOffering,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success">Oferta de volume criada.</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="seasonId">Temporada</Label>
          <select
            id="seasonId"
            name="seasonId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="volumeId">Volume</Label>
          <select
            id="volumeId"
            name="volumeId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {volumes.map((volume) => (
              <option key={volume.id} value={volume.id}>
                {volume.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar oferta
      </Button>
    </form>
  );
}
