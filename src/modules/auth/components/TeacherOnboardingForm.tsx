"use client";

import { useActionState } from "react";
import {
  acceptTeacherInvitation,
  type AcceptTeacherInvitationState,
} from "../actions/acceptTeacherInvitation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Alert } from "@/components/ui/Alert";

const initialState: AcceptTeacherInvitationState = {};

export function TeacherOnboardingForm({
  token,
  defaultFullName,
  defaultPhone,
  email,
}: {
  token: string;
  defaultFullName: string;
  defaultPhone: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState(
    acceptTeacherInvitation,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Bem-vindo à Escola Makários
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Confirme seus dados e crie sua senha para acessar suas aulas.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="email">E-mail de acesso</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
        />
        <p className="mt-1 text-xs text-neutral-500">
          Confira se está certo — é o e-mail com o qual você vai entrar. Pode corrigir se não for o seu.
        </p>
      </div>

      <div>
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={defaultFullName}
          required
        />
      </div>

      <div>
        <Label htmlFor="phone">WhatsApp (com DDD)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="62 99999-9999"
          defaultValue={defaultPhone}
          required
        />
      </div>

      <div>
        <Label htmlFor="password">Criar senha</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
        />
        <p className="mt-1 text-xs text-neutral-500">
          Mínimo 8 caracteres, com letra maiúscula, minúscula e número.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </div>

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        Concluir e acessar minhas aulas
      </Button>
    </form>
  );
}
