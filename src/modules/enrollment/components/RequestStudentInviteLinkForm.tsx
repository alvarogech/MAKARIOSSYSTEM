"use client";

import { useActionState } from "react";
import {
  requestStudentInviteLink,
  type RequestStudentInviteLinkState,
} from "../actions/requestStudentInviteLink";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: RequestStudentInviteLinkState = {};

export function RequestStudentInviteLinkForm() {
  const [state, formAction, isPending] = useActionState(requestStudentInviteLink, initialState);

  if (state.success) {
    return (
      <Alert variant="success">
        Se houver um acesso pendente para este e-mail, enviamos o link novamente.
        Confira também a caixa de spam e use o link do e-mail mais recente.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <p className="text-sm text-neutral-600">
        Informe o e-mail que você usou na inscrição e enviamos um novo link agora mesmo.
      </p>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <div>
        <Label htmlFor="email">E-mail da inscrição</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" isLoading={isPending} className="w-full">
        Receber novo link
      </Button>
    </form>
  );
}
