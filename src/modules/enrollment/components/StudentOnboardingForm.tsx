"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  acceptStudentInvitation,
  type AcceptStudentInvitationState,
} from "../actions/acceptStudentInvitation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Alert } from "@/components/ui/Alert";
import { CopyButton } from "@/components/ui/CopyButton";

const initialState: AcceptStudentInvitationState = {};

export function StudentOnboardingForm({
  token,
  defaultFullName,
  email,
}: {
  token: string;
  defaultFullName: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState(acceptStudentInvitation, initialState);

  if (state.result) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Conta criada!</h1>
        <Alert variant="success">
          <div className="flex flex-col gap-2">
            <p>
              Seu e-mail de contato pode ser o mesmo de outra pessoa da família — por isso, para
              entrar da próxima vez, use este <strong>código de acesso pessoal</strong>, junto com a
              senha que você acabou de criar:
            </p>
            <p className="text-center text-2xl font-bold tracking-wide text-brand-blue-dark">
              {state.result.accessCode}
            </p>
            <CopyButton value={state.result.accessCode} label="código" className="self-center" />
            <p className="text-xs text-neutral-500">
              Também enviamos este código por e-mail, caso você precise consultar depois.
            </p>
          </div>
        </Alert>
        <Link href="/meus-volumes" className="self-center text-sm font-medium text-brand-blue hover:underline">
          Ir para minhas turmas →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Bem-vindo à Escola Makários
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Confirme seus dados e crie sua senha para acessar sua turma.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="email">E-mail de contato</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={email} required />
        <p className="mt-1 text-xs text-neutral-500">
          Usado só para a escola te avisar de coisas importantes — pode ser o mesmo e-mail de outra
          pessoa da sua família. Seu login será um código próprio, mostrado no final deste cadastro.
        </p>
      </div>

      <div>
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" autoComplete="name" defaultValue={defaultFullName} required />
      </div>

      <div>
        <Label htmlFor="password">Criar senha</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" required />
        <p className="mt-1 text-xs text-neutral-500">
          Mínimo 8 caracteres, com letra maiúscula, minúscula e número.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </div>

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        Concluir cadastro
      </Button>
    </form>
  );
}
