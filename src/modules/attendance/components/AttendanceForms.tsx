"use client";

import { useActionState, useState, useTransition } from "react";
import { generateQrCodes, setRequireLocation, updateLocationCoordinates, type SimpleState } from "../actions/manageAttendance";
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

export function RequireLocationSwitch({ initial: initialValue }: { initial: boolean }) {
  const [on, setOn] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const result = await setRequireLocation(next);
      if (result.error) {
        setOn(!next);
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-neutral-900">Exigir localização</p>
          <p className="text-sm text-neutral-500">
            {on
              ? "Ligada: sem localização ou longe do local, a presença não é registrada."
              : "Desligada: a presença é registrada mesmo sem localização, com a marca \"sem localização\" ou \"longe do local\" na lista."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Exigir localização"
          disabled={pending}
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brand-blue" : "bg-neutral-300"}`}
        >
          <span
            className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : ""}`}
          />
        </button>
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}
