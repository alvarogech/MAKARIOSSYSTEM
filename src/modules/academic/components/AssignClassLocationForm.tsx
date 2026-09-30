"use client";

import { useActionState } from "react";
import { assignClassLocation, type AssignClassLocationState } from "../actions/createLocation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: AssignClassLocationState = {};

export function AssignClassLocationForm({
  classId,
  locations,
  currentLocationId,
}: {
  classId: string;
  locations: { id: string; name: string }[];
  currentLocationId: string | null;
}) {
  const [state, formAction, isPending] = useActionState(assignClassLocation, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="classId" value={classId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <div>
        <Label htmlFor={`locationId-${classId}`}>Local desta turma</Label>
        <select
          id={`locationId-${classId}`}
          name="locationId"
          required
          defaultValue={currentLocationId ?? ""}
          className="h-9 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2 text-sm"
        >
          <option value="" disabled>
            Selecione um local
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" size="sm" isLoading={isPending}>
        Salvar local
      </Button>
      {state.success ? <span className="text-xs text-success">Salvo.</span> : null}
    </form>
  );
}
