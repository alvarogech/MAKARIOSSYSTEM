"use client";

import { useActionState } from "react";
import { setDeclarationWindow, type DeclarationState } from "../actions/declarations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const selectClass = "w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800";

export function DeclarationWindowForm({ meetings }: { meetings: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<DeclarationState, FormData>(setDeclarationWindow, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div>
        <Label htmlFor="win-meeting">Encontro</Label>
        <select id="win-meeting" name="meetingId" className={selectClass} required defaultValue="">
          <option value="" disabled>
            Escolha o encontro
          </option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="win-until">Aberta até</Label>
        <Input id="win-until" name="until" type="date" required />
      </div>
      <Button type="submit" isLoading={pending}>
        Abrir janela
      </Button>
      {state.error ? (
        <div className="sm:col-span-3">
          <Alert variant="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.success ? (
        <div className="sm:col-span-3">
          <Alert variant="success">Janela atualizada.</Alert>
        </div>
      ) : null}
    </form>
  );
}

export function CloseWindowButton({ meetingId }: { meetingId: string }) {
  const [, action, pending] = useActionState<DeclarationState, FormData>(setDeclarationWindow, {});
  return (
    <form action={action}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="close" value="1" />
      <Button type="submit" size="sm" variant="ghost" isLoading={pending}>
        Encerrar
      </Button>
    </form>
  );
}
