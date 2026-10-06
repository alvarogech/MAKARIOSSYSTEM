"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { formatBrazilianPhone } from "@/services/phone";
import { updateEnrollmentRequest, type UpdateEnrollmentRequestState } from "../actions/updateEnrollmentRequest";
import type { EnrollmentRequestRow } from "../types";

const selectClassName =
  "h-9 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2 text-sm " +
  "focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

export function EnrollmentRequestEditForm({ row }: { row: EnrollmentRequestRow }) {
  const [state, formAction, isPending] = useActionState<UpdateEnrollmentRequestState, FormData>(
    updateEnrollmentRequest,
    {},
  );
  const [primaryVolume, setPrimaryVolume] = useState<string>(row.primaryVolumeSlug);
  const [primarySchedule, setPrimarySchedule] = useState<string>(row.primaryScheduleSlug);
  const [wantsSecond, setWantsSecond] = useState(row.wantsSecondVolume);
  const hasAccount = Boolean(row.studentId);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
      <input type="hidden" name="enrollmentRequestId" value={row.id} />

      <div>
        <Label htmlFor={`edit-name-${row.id}`}>Nome completo</Label>
        <Input id={`edit-name-${row.id}`} name="fullName" defaultValue={row.fullName} required />
      </div>
      <div>
        <Label htmlFor={`edit-email-${row.id}`}>E-mail</Label>
        <Input
          id={`edit-email-${row.id}`}
          name="email"
          type="email"
          defaultValue={row.email}
          readOnly={hasAccount}
          required
        />
        {hasAccount ? (
          <p className="mt-1 text-xs text-neutral-400">
            A pessoa já tem conta — o e-mail é o login e não muda por aqui.
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`edit-phone-${row.id}`}>WhatsApp</Label>
        <Input id={`edit-phone-${row.id}`} name="phone" defaultValue={formatBrazilianPhone(row.phone)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`edit-pv-${row.id}`}>Volume principal</Label>
          <select
            id={`edit-pv-${row.id}`}
            name="primaryVolume"
            className={selectClassName}
            value={primaryVolume}
            onChange={(event) => setPrimaryVolume(event.target.value)}
          >
            {ENROLLMENT_VOLUMES.map((v) => (
              <option key={v.slug} value={v.slug}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`edit-ps-${row.id}`}>Horário</Label>
          <select
            id={`edit-ps-${row.id}`}
            name="primarySchedule"
            className={selectClassName}
            value={primarySchedule}
            onChange={(event) => setPrimarySchedule(event.target.value)}
          >
            {ENROLLMENT_SCHEDULES.map((s) => (
              <option key={s.slug} value={s.slug}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="wantsSecondVolume"
          checked={wantsSecond}
          onChange={(event) => setWantsSecond(event.target.checked)}
          className="size-4 accent-brand-blue"
        />
        Cursa um segundo volume
      </label>

      {wantsSecond ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`edit-sv-${row.id}`}>Segundo volume</Label>
            <select
              id={`edit-sv-${row.id}`}
              name="secondaryVolume"
              className={selectClassName}
              defaultValue={row.secondaryVolumeSlug ?? ""}
              required
            >
              <option value="" disabled>Selecione</option>
              {ENROLLMENT_VOLUMES.filter((v) => v.slug !== primaryVolume).map((v) => (
                <option key={v.slug} value={v.slug}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`edit-ss-${row.id}`}>Horário</Label>
            <select
              id={`edit-ss-${row.id}`}
              name="secondarySchedule"
              className={selectClassName}
              defaultValue={row.secondaryScheduleSlug ?? ""}
              required
            >
              <option value="" disabled>Selecione</option>
              {ENROLLMENT_SCHEDULES.filter((s) => s.slug !== primarySchedule).map((s) => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" isLoading={isPending}>
          Salvar alterações
        </Button>
        {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
        <FormError message={state.error} />
      </div>
      <p className="text-xs text-neutral-400">
        Vale em qualquer fase. Se a pessoa já tem matrícula, ela é movida ou criada na turma nova, e a
        do volume que saiu é cancelada (o histórico fica). Se ainda não aceitou o convite, o convite é
        ajustado.
      </p>
    </form>
  );
}
