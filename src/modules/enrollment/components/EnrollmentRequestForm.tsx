"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { formatCpf } from "@/services/cpf";
import {
  submitEnrollmentRequest,
  type EnrollmentRequestState,
} from "../actions/submitEnrollmentRequest";

const initialState: EnrollmentRequestState = {};
const fieldClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";
const textareaClass =
  "min-h-28 w-full resize-y rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.[0]) return null;
  return <p className="mt-1.5 text-sm text-danger" role="alert">{errors[0]}</p>;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function EnrollmentRequestForm() {
  const [state, formAction, isPending] = useActionState(
    submitEnrollmentRequest,
    initialState,
  );
  const [primaryVolume, setPrimaryVolume] = useState("essencia");
  const [wantsSecondVolume, setWantsSecondVolume] = useState(false);
  const needsDeclaration = primaryVolume !== "essencia" || wantsSecondVolume;

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center" aria-live="polite">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-blue-light text-brand-blue">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Inscrição recebida</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-600">
            Sua vaga na Escola Makários está garantida. Se precisarmos de mais alguma
            informação, nossa equipe entra em contato pelos dados que você enviou.
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-brand-blue/20 bg-brand-blue-light px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600">Seu protocolo</p>
          <p className="mt-1 text-xl font-semibold tracking-wide text-brand-blue-dark">{state.protocol}</p>
        </div>
        <p className="text-sm text-neutral-500">Guarde este número para consultar sua solicitação.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-7" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <section aria-labelledby="personal-data-title">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">01</p>
        <h2 id="personal-data-title" className="mt-0.5 text-lg font-semibold text-neutral-900">Seus dados</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required hasError={Boolean(state.fieldErrors?.fullName)} />
            <FieldError errors={state.fieldErrors?.fullName} />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              required
              hasError={Boolean(state.fieldErrors?.cpf)}
              onChange={(event) => { event.currentTarget.value = formatCpf(event.currentTarget.value); }}
            />
            <FieldError errors={state.fieldErrors?.cpf} />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(62) 99999-9999"
              required
              hasError={Boolean(state.fieldErrors?.phone)}
              onChange={(event) => { event.currentTarget.value = formatPhone(event.currentTarget.value); }}
            />
            <FieldError errors={state.fieldErrors?.phone} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required hasError={Boolean(state.fieldErrors?.email)} />
            <FieldError errors={state.fieldErrors?.email} />
          </div>
        </div>
      </section>

      <section aria-labelledby="main-volume-title" className="border-t border-neutral-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">02</p>
        <h2 id="main-volume-title" className="mt-0.5 text-lg font-semibold text-neutral-900">Volume</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="primaryVolume">Qual volume você deseja cursar?</Label>
            <select
              id="primaryVolume"
              name="primaryVolume"
              className={fieldClass}
              value={primaryVolume}
              onChange={(event) => setPrimaryVolume(event.target.value)}
              required
            >
              {ENROLLMENT_VOLUMES.map((volume) => (
                <option key={volume.slug} value={volume.slug}>{volume.label}</option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors?.primaryVolume} />
          </div>
          <div>
            <Label htmlFor="primarySchedule">Turma preferida</Label>
            <select id="primarySchedule" name="primarySchedule" className={fieldClass} required>
              {ENROLLMENT_SCHEDULES.map((schedule) => (
                <option key={schedule.slug} value={schedule.slug}>
                  {schedule.label} · {schedule.time}
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors?.primarySchedule} />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="wantsSecondVolume"
            className="size-4 rounded border-neutral-300 accent-brand-blue"
            checked={wantsSecondVolume}
            onChange={(event) => setWantsSecondVolume(event.target.checked)}
          />
          <span className="text-sm text-neutral-500">
            Quero cursar um segundo volume ao mesmo tempo
          </span>
        </label>

        {wantsSecondVolume ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="secondaryVolume">Segundo volume</Label>
              <select id="secondaryVolume" name="secondaryVolume" className={fieldClass} required>
                <option value="">Selecione</option>
                {ENROLLMENT_VOLUMES.filter((volume) => volume.slug !== primaryVolume).map((volume) => (
                  <option key={volume.slug} value={volume.slug}>{volume.label}</option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors?.secondaryVolume} />
            </div>
            <div>
              <Label htmlFor="secondarySchedule">Turma do segundo volume</Label>
              <select id="secondarySchedule" name="secondarySchedule" className={fieldClass} required>
                <option value="">Selecione</option>
                {ENROLLMENT_SCHEDULES.map((schedule) => (
                  <option key={schedule.slug} value={schedule.slug}>
                    {schedule.label} · {schedule.time}
                  </option>
                ))}
              </select>
              <FieldError errors={state.fieldErrors?.secondarySchedule} />
            </div>
          </div>
        ) : null}
      </section>

      {needsDeclaration ? (
        <section className="border-t border-neutral-100 pt-6">
          <Label htmlFor="prerequisiteDeclaration">Já cursou algum volume antes?</Label>
          <p className="mb-2 text-xs leading-5 text-neutral-500">
            Conte quando e onde cursou. Se está pedindo dois volumes ao mesmo tempo, explique
            também o motivo — a coordenação avalia caso a caso.
          </p>
          <textarea id="prerequisiteDeclaration" name="prerequisiteDeclaration" className={textareaClass} required />
          <FieldError errors={state.fieldErrors?.prerequisiteDeclaration} />
        </section>
      ) : null}

      <section className="border-t border-neutral-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">03</p>
        <h2 className="mt-0.5 text-lg font-semibold text-neutral-900">Confirmação</h2>
        <div className="mt-4">
          <Label htmlFor="notes">Observações <span className="font-normal text-neutral-400">(opcional)</span></Label>
          <textarea id="notes" name="notes" className={textareaClass} />
          <FieldError errors={state.fieldErrors?.notes} />
        </div>
      </section>

      <div className="hidden" aria-hidden="true">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm leading-5 text-neutral-600">
          <input type="checkbox" name="privacyConsent" className="mt-0.5 size-4 shrink-0 accent-brand-blue" required />
          <span>Autorizo o tratamento dos meus dados pessoais para análise da inscrição e contato da Escola Makários.</span>
        </label>
        <FieldError errors={state.fieldErrors?.privacyConsent} />
      </div>

      <Button type="submit" size="lg" isLoading={isPending} className="w-full sm:w-auto sm:self-end">
        Confirmar inscrição
      </Button>
    </form>
  );
}

