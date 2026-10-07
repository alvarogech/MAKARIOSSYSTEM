"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import {
  linkStudentInvitationToAccount,
  type LinkStudentInvitationState,
} from "../actions/acceptStudentInvitation";

const initialState: LinkStudentInvitationState = {};

/** Para quem já tem conta com este e-mail (ex.: professor): adiciona o perfil de aluno a ela. */
export function LinkExistingAccountForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(linkStudentInvitationToAccount, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Você já tem uma conta</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Já existe uma conta da Escola Makários com o e-mail <strong>{email}</strong> (por exemplo, a sua de
          professor). Não precisa criar outra: entre com a senha dela e adicionamos o perfil de <strong>aluno</strong>{" "}
          à mesma conta. Depois, ao entrar, você escolhe se quer ver o painel de aluno ou o de professor.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="password">Senha da sua conta atual</Label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>

      <Button type="submit" isLoading={isPending} className="w-full">
        Adicionar o perfil de aluno
      </Button>
    </form>
  );
}
