"use client";

import { useActionState, useMemo, useState } from "react";
import {
  assignTeacher,
  type AssignTeacherState,
} from "../actions/assignTeacher";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: AssignTeacherState = {};

export function AssignTeacherForm({
  classes,
  modules,
}: {
  classes: { id: string; label: string; volumeId: string }[];
  modules: { id: string; name: string; volumeId: string; academicHours: number | null }[];
}) {
  const [state, formAction, isPending] = useActionState(
    assignTeacher,
    initialState,
  );
  const [classId, setClassId] = useState(classes[0]?.id ?? "");

  const selectedVolumeId = classes.find((k) => k.id === classId)?.volumeId;
  const modulesForClass = useMemo(
    () => modules.filter((m) => m.volumeId === selectedVolumeId),
    [modules, selectedVolumeId],
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.warning ? <Alert variant="warning">{state.warning}</Alert> : null}
      {state.success ? (
        <Alert variant="success">Professor designado à turma.</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="classId">Turma</Label>
          <select
            id="classId"
            name="classId"
            required
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="moduleId">Matéria (opcional)</Label>
          <select
            id="moduleId"
            name="moduleId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="">Turma inteira (todas as matérias)</option>
            {modulesForClass.map((mod) => (
              <option key={mod.id} value={mod.id}>
                {mod.name}
                {mod.academicHours ? ` (${mod.academicHours}h)` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            Deixe em &quot;turma inteira&quot; para o vínculo tradicional, ou
            escolha uma matéria específica do volume desta turma.
          </p>
        </div>

        <div>
          <Label htmlFor="teacherEmail">E-mail do professor</Label>
          <Input id="teacherEmail" name="teacherEmail" type="email" required />
          <p className="mt-1 text-xs text-neutral-500">
            A pessoa precisa já ter aceitado um convite com perfil
            Professor.
          </p>
        </div>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Designar professor
      </Button>
    </form>
  );
}
