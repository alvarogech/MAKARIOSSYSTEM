"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type SignInState } from "../actions/signIn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormError } from "@/components/ui/FormError";
import { Alert } from "@/components/ui/Alert";

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Entrar</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Acesse com o e-mail e senha da sua conta na Plataforma Makários.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          hasError={Boolean(state.error)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link
            href="/recuperar-senha"
            className="mb-1.5 text-xs font-medium text-brand-blue hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          hasError={Boolean(state.error)}
        />
        <FormError message={state.error} />
      </div>

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        Entrar
      </Button>

      <p className="text-center text-xs text-neutral-500">
        Seu acesso é criado por convite da coordenação da Escola Makários.
        Recebeu um convite?{" "}
        <Link href="/primeiro-acesso" className="font-medium text-brand-blue hover:underline">
          Complete seu primeiro acesso
        </Link>
        .
      </p>
    </form>
  );
}
