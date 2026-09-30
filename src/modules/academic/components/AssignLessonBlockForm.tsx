"use client";

import { useActionState, useState } from "react";
import { assignLessonBlock, type AssignLessonBlockState } from "../actions/assignLessonBlock";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: AssignLessonBlockState = {};

export function AssignLessonBlockForm({
  meetings,
  modules,
  nextOrderIndexByMeeting,
}: {
  meetings: { id: string; label: string }[];
  modules: { id: string; name: string }[];
  nextOrderIndexByMeeting: Record<string, number>;
}) {
  const [state, formAction, isPending] = useActionState(assignLessonBlock, initialState);
  const [meetingId, setMeetingId] = useState(meetings[0]?.id ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Aula adicionada à escala.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="classMeetingId">Encontro</Label>
          <select
            id="classMeetingId"
            name="classMeetingId"
            required
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="moduleId">Tema / módulo</Label>
          <select
            id="moduleId"
            name="moduleId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="">Tema ainda a definir</option>
            {modules.map((mod) => (
              <option key={mod.id} value={mod.id}>
                {mod.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="teacherEmail">E-mail do professor</Label>
          <Input id="teacherEmail" name="teacherEmail" type="email" placeholder="Deixe em branco se ainda não definido" />
        </div>

        <div>
          <Label htmlFor="orderIndex">Posição no encontro</Label>
          <Input
            id="orderIndex"
            name="orderIndex"
            type="number"
            min={1}
            key={meetingId}
            defaultValue={nextOrderIndexByMeeting[meetingId] ?? 1}
            required
          />
          <p className="mt-1 text-xs text-neutral-500">
            1 para o primeiro bloco do dia, 2 para o segundo, e assim por diante.
          </p>
        </div>

        <div>
          <Label htmlFor="startTime">Início</Label>
          <Input id="startTime" name="startTime" type="time" required />
        </div>

        <div>
          <Label htmlFor="endTime">Término</Label>
          <Input id="endTime" name="endTime" type="time" required />
        </div>
      </div>

      <div>
        <Label htmlFor="coordinationNotes">Observações da coordenação (opcional)</Label>
        <textarea
          id="coordinationNotes"
          name="coordinationNotes"
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Adicionar aula à escala
      </Button>
    </form>
  );
}
