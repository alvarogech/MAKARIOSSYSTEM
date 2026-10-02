"use client";

import { useActionState } from "react";
import {
  updateEnrollmentStatus,
  type UpdateEnrollmentStatusState,
  transferEnrollmentClass,
  type TransferEnrollmentClassState,
} from "../actions/manageEnrollment";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";
import { enrollmentStatusValues } from "../schemas";

const selectClassName =
  "h-9 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2 text-sm " +
  "focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

export function EnrollmentRowActions({
  enrollmentId,
  currentStatus,
  currentClassId,
  classesInSameOffering,
}: {
  enrollmentId: string;
  currentStatus: string;
  currentClassId: string;
  classesInSameOffering: { id: string; name: string }[];
}) {
  const [statusState, statusAction, statusPending] = useActionState<
    UpdateEnrollmentStatusState,
    FormData
  >(updateEnrollmentStatus, {});
  const [transferState, transferAction, transferPending] = useActionState<
    TransferEnrollmentClassState,
    FormData
  >(transferEnrollmentClass, {});

  const otherClasses = classesInSameOffering.filter((c) => c.id !== currentClassId);

  return (
    <div className="mt-2 flex flex-wrap items-start gap-4">
      <form action={statusAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <select name="status" defaultValue={currentStatus} className={selectClassName}>
          {enrollmentStatusValues.map((value) => (
            <option key={value} value={value}>
              {ENROLLMENT_STATUS_LABELS[value] ?? value}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" isLoading={statusPending}>
          Salvar status
        </Button>
        {statusState.success ? <span className="text-xs text-success">Atualizado.</span> : null}
        <FormError message={statusState.error} />
      </form>

      {otherClasses.length > 0 ? (
        <form action={transferAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <select name="classId" defaultValue="" className={selectClassName} required>
            <option value="" disabled>
              Mover para…
            </option>
            {otherClasses.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary" isLoading={transferPending}>
            Mover de turma
          </Button>
          {transferState.success ? <span className="text-xs text-success">Movido.</span> : null}
          <FormError message={transferState.error} />
        </form>
      ) : null}
    </div>
  );
}
