"use client";

import { useActionState } from "react";
import {
  createEnrollment,
  type CreateEnrollmentState,
} from "../actions/createEnrollment";
import { PrerequisiteExceptionForm } from "./PrerequisiteExceptionForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateEnrollmentState = {};

export function EnrollmentForm({
  offerings,
  classes,
  volumeNamesById,
}: {
  offerings: { id: string; label: string }[];
  classes: { id: string; label: string; offeringId: string }[];
  volumeNamesById: Record<string, string>;
}) {
  const [state, formAction, isPending] = useActionState(
    createEnrollment,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
        {state.success ? (
          <Alert variant="success">Matrícula criada.</Alert>
        ) : null}

        <div>
          <Label htmlFor="studentEmail">E-mail do aluno</Label>
          <Input id="studentEmail" name="studentEmail" type="email" required />
          <p className="mt-1 text-xs text-neutral-500">
            A pessoa precisa já ter aceitado um convite com perfil Aluno.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="seasonVolumeOfferingId">Oferta de volume</Label>
            <select
              id="seasonVolumeOfferingId"
              name="seasonVolumeOfferingId"
              required
              className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="classId">Turma principal</Label>
            <select
              id="classId"
              name="classId"
              required
              className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              A turma precisa pertencer à mesma oferta selecionada acima.
            </p>
          </div>
        </div>

        <Button type="submit" isLoading={isPending} className="self-start">
          Matricular
        </Button>
      </form>

      {state.blocked ? (
        <Alert variant="danger">
          <p>
            Matrícula bloqueada: pré-requisito não concluído —{" "}
            <strong>
              {state.blocked.missingVolumeIds
                .map((id) => volumeNamesById[id] ?? id)
                .join(", ")}
            </strong>
            .
          </p>
          {state.blocked.missingVolumeIds.map((missingId) => (
            <PrerequisiteExceptionForm
              key={missingId}
              studentEmail={state.blocked!.studentEmail}
              volumeId={state.blocked!.volumeId}
              missingPrerequisiteVolumeId={missingId}
              missingVolumeName={volumeNamesById[missingId] ?? missingId}
            />
          ))}
        </Alert>
      ) : null}
    </div>
  );
}
