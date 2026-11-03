"use client";

import { useActionState } from "react";
import { submitStudentAdjustment, type AdjustmentFormState } from "../actions/submitStudentAdjustment";
import { ADJUSTMENT_PROBLEMS } from "../helpRequest";
import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";

const SELECT_CLASS =
  "h-11 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-danger">{message}</p> : null;
}

export function StudentAdjustmentForm() {
  const [state, action, pending] = useActionState(submitStudentAdjustment, {} as AdjustmentFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  if (state.success) {
    return (
      <Alert variant="success">
        Pedido enviado. A coordenação vai analisar e falar com você pelo WhatsApp do seu cadastro. Você acompanha a resposta
        nesta página.
      </Alert>
    );
  }

  return (
    // A `key` recria o formulário com o que o aluno digitou quando o servidor devolve um erro.
    <form action={action} key={JSON.stringify(values ?? {})} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">
          O que está errado? <span className="font-normal text-neutral-500">Pode marcar mais de um.</span>
        </legend>
        {ADJUSTMENT_PROBLEMS.map((problem) => (
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
        <FieldError message={errors.problems} />
      </fieldset>

      <div className="rounded-[var(--radius-sm)] border border-neutral-200 p-3">
        <p className="text-sm font-medium text-neutral-800">Se for volume ou turma: onde você deveria estar?</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wantedVolume">Volume</Label>
            <select
              id="wantedVolume"
              name="wantedVolume"
              defaultValue={values?.wantedVolume ?? ""}
              className={`${SELECT_CLASS} ${errors.wantedVolume ? "border-danger focus:ring-danger" : "border-neutral-200 focus:border-brand-blue focus:ring-brand-blue"}`}
            >
              <option value="">Escolha…</option>
              {ENROLLMENT_VOLUMES.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.wantedVolume} />
          </div>
          <div>
            <Label htmlFor="wantedSchedule">Horário</Label>
            <select
              id="wantedSchedule"
              name="wantedSchedule"
              defaultValue={values?.wantedSchedule ?? ""}
              className={`${SELECT_CLASS} ${errors.wantedSchedule ? "border-danger focus:ring-danger" : "border-neutral-200 focus:border-brand-blue focus:ring-brand-blue"}`}
            >
              <option value="">Escolha…</option>
              {ENROLLMENT_SCHEDULES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label} ({s.time})
                </option>
              ))}
            </select>
            <FieldError message={errors.wantedSchedule} />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="message">Conte com as suas palavras</Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={2000}
          defaultValue={values?.message}
          placeholder="Ex.: eu me inscrevi no Caminho, mas apareço matriculado em Voz."
          className={`w-full rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
            errors.message ? "border-danger focus:ring-danger" : "border-neutral-200 focus:border-brand-blue focus:ring-brand-blue"
          }`}
        />
        <FieldError message={errors.message} />
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Button type="submit" className="w-full sm:w-auto" isLoading={pending}>
        Pedir ajuste à coordenação
      </Button>
    </form>
  );
}

