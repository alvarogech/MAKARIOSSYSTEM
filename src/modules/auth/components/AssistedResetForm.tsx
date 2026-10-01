"use client";

import { useActionState } from "react";
import {
  acceptAssistedPasswordReset,
  type AcceptAssistedResetState,
} from "../actions/acceptAssistedPasswordReset";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Alert } from "@/components/ui/Alert";

const initialState: AcceptAssistedResetState = {};

export function AssistedResetForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    acceptAssistedPasswordReset,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Criar nova senha</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Defina sua nova senha de acesso à Plataforma Makários.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="password">Nova senha</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" required />
        <p className="mt-1 text-xs text-neutral-500">
          Mínimo 8 caracteres, com letra maiúscula, minúscula e número.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </div>

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        Salvar nova senha e entrar
      </Button>
    </form>
  );
}
