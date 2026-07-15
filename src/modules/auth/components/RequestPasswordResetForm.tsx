"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type RequestPasswordResetState,
} from "../actions/requestPasswordReset";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: RequestPasswordResetState = {};

export function RequestPasswordResetForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.success) {
    return (
      <Alert variant="success">
        Se este e-mail estiver cadastrado, enviamos um link de recuperação
        de senha para ele. Verifique também a caixa de spam.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Recuperar senha
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Informe o e-mail da sua conta. Enviaremos um link para você criar
          uma nova senha.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        Enviar link de recuperação
      </Button>

      <p className="text-center text-xs text-neutral-500">
        <Link href="/login" className="font-medium text-brand-blue hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
