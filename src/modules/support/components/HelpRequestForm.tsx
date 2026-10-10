"use client";

import { useActionState } from "react";
import { submitHelpRequest, type HelpFormState } from "../actions/submitHelpRequest";
import { HELP_PROBLEMS } from "../helpRequest";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-danger">{message}</p> : null;
}

export function HelpRequestForm() {
  const [state, action, pending] = useActionState(submitHelpRequest, {} as HelpFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  if (state.success) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <h1 className="text-xl font-semibold text-neutral-900">Pedido enviado</h1>
        <p className="text-neutral-700">
          A coordenação recebeu o seu pedido e vai falar com você pelo WhatsApp que você informou.
        </p>
        <p className="text-sm text-neutral-500">Não precisa mandar de novo.</p>
      </Card>
    );
  }

  return (
    // A `key` recria o formulário com o que a pessoa digitou quando o servidor devolve um erro.
    <form action={action} key={JSON.stringify(values ?? {})} className="flex flex-col gap-5" noValidate>
      <Card className="flex flex-col gap-4 py-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Precisa de ajuda?</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Conte o que está acontecendo. A coordenação responde pelo WhatsApp.
          </p>
        </div>

        <div>
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            defaultValue={values?.fullName}
            hasError={!!errors.fullName}
            required
          />
          <FieldError message={errors.fullName} />
        </div>

        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            defaultValue={values?.cpf}
            hasError={!!errors.cpf}
            required
          />
          <FieldError message={errors.cpf} />
        </div>

        <div>
          <Label htmlFor="phone">WhatsApp com DDD</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(62) 90000-0000"
            defaultValue={values?.phone}
            hasError={!!errors.phone}
            required
          />
          <FieldError message={errors.phone} />
        </div>
      </Card>

      <Card className="flex flex-col gap-3 py-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-neutral-900">
            Qual é o problema? <span className="font-normal text-neutral-500">Pode marcar mais de um.</span>
          </legend>
          {HELP_PROBLEMS.map((problem) => (
            <label
              key={problem.code}
              className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm text-neutral-800 transition-colors hover:border-brand-blue has-[:checked]:border-brand-blue has-[:checked]:bg-brand-blue-light"
            >
              <input
                type="checkbox"
                name="problems"
                value={problem.code}
                defaultChecked={values?.problems.includes(problem.code)}
                className="mt-0.5 size-5 shrink-0 accent-brand-blue"
              />
              <span>{problem.label}</span>
            </label>
          ))}
        </fieldset>
        <FieldError message={errors.problems} />

        <div>
          <Label htmlFor="message">Conte com as suas palavras</Label>
          <textarea
            id="message"
            name="message"
            rows={4}
            maxLength={2000}
            defaultValue={values?.message}
            placeholder="Ex.: tentei entrar ontem e apareceu “senha inválida”."
            className={`w-full rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
              errors.message ? "border-danger focus:ring-danger" : "border-neutral-200 focus:border-brand-blue focus:ring-brand-blue"
            }`}
          />
          <FieldError message={errors.message} />
        </div>
      </Card>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Button type="submit" className="w-full" isLoading={pending}>
        Enviar pedido de ajuda
      </Button>
      <p className="text-center text-xs text-neutral-400">
        Seus dados são usados só para a coordenação encontrar a sua inscrição e falar com você.
      </p>
    </form>
  );
}
