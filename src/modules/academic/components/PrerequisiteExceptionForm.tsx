"use client";

import { useActionState } from "react";
import {
  createPrerequisiteException,
  type CreatePrerequisiteExceptionState,
} from "../actions/createPrerequisiteException";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreatePrerequisiteExceptionState = {};

export function PrerequisiteExceptionForm({
  studentEmail,
  volumeId,
  missingPrerequisiteVolumeId,
  missingVolumeName,
}: {
  studentEmail: string;
  volumeId: string;
  missingPrerequisiteVolumeId: string;
  missingVolumeName: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createPrerequisiteException,
    initialState,
  );

  if (state.success) {
    return (
      <Alert variant="success">
        Exceção autorizada e auditada. Tente matricular o aluno novamente
        acima.
      </Alert>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-3 rounded-[var(--radius-sm)] border border-warning/30 bg-warning/5 p-4"
      noValidate
    >
      <input type="hidden" name="studentEmail" value={studentEmail} />
      <input type="hidden" name="volumeId" value={volumeId} />
      <input
        type="hidden"
        name="missingPrerequisiteVolumeId"
        value={missingPrerequisiteVolumeId}
      />

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <p className="text-sm text-neutral-700">
        Autorizar matrícula sem <strong>{missingVolumeName}</strong>{" "}
        concluído. Esta ação é registrada na auditoria.
      </p>

      <div>
        <Label htmlFor={`justification-${missingPrerequisiteVolumeId}`}>
          Justificativa
        </Label>
        <textarea
          id={`justification-${missingPrerequisiteVolumeId}`}
          name="justification"
          required
          minLength={10}
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" variant="secondary" isLoading={isPending} className="self-start">
        Autorizar exceção
      </Button>
    </form>
  );
}
