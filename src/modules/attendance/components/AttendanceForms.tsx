"use client";

import { useActionState } from "react";
import { generateQrCodes, updateLocationCoordinates, type SimpleState } from "../actions/manageAttendance";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initial: SimpleState = {};

export function GenerateQrCodesForm() {
  const [state, action, pending] = useActionState(generateQrCodes, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Button type="submit" isLoading={pending} className="self-start">
        Gerar os QR Codes
      </Button>
    </form>
  );
}

export function LocationCoordinatesForm({ id, current }: { id: string; current: string }) {
  const [state, action, pending] = useActionState(updateLocationCoordinates, initial);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
      <input type="hidden" name="id" value={id} />
      <Input name="coordinates" defaultValue={current} placeholder="-16.6973877, -49.2767771" aria-label="Coordenadas" />
      <Button type="submit" isLoading={pending} variant="secondary">
        Salvar coordenadas
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Coordenadas salvas.</Alert> : null}
    </form>
  );
}

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      Imprimir
    </Button>
  );
}
