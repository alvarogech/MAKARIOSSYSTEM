"use client";

import { useActionState } from "react";
import {
  createInvitation,
  type CreateInvitationState,
} from "../actions/createInvitation";
import type { RoleSlug } from "@/authorization";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateInvitationState = {};

const INVITABLE_ROLES: RoleSlug[] = [
  "student",
  "teacher",
  "content_editor",
  "coordinator",
  "admin",
];

export function CreateInvitationForm() {
  const [state, formAction, isPending] = useActionState(
    createInvitation,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert variant="success">Convite enviado com sucesso.</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>

      <div>
        <Label htmlFor="roleSlug">Perfil</Label>
        <select
          id="roleSlug"
          name="roleSlug"
          required
          className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        >
          {INVITABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Enviar convite
      </Button>
    </form>
  );
}
