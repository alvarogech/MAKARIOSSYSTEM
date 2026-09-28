"use client";

import { useActionState } from "react";
import { Pencil } from "lucide-react";
import {
  setEnrollmentTurmaCapacity,
  type SetCapacityState,
} from "../actions/setEnrollmentTurmaCapacity";
import type { EnrollmentScheduleSlug, EnrollmentVolumeSlug } from "@/config/enrollment";

const initialState: SetCapacityState = {};

/**
 * Formulário mínimo, sempre visível, para configurar a capacidade de uma
 * turma. Ausência de capacidade configurada nunca é tratada como zero —
 * o campo só aparece preenchido quando já existe uma linha salva.
 */
export function EnrollmentCapacityEditor({
  seasonId,
  volumeSlug,
  scheduleSlug,
  currentCapacity,
}: {
  seasonId: string;
  volumeSlug: EnrollmentVolumeSlug;
  scheduleSlug: EnrollmentScheduleSlug;
  currentCapacity: number | null;
}) {
  const [state, formAction, isPending] = useActionState(setEnrollmentTurmaCapacity, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="volumeSlug" value={volumeSlug} />
      <input type="hidden" name="scheduleSlug" value={scheduleSlug} />
      <Pencil className="size-3 shrink-0 text-neutral-300" aria-hidden="true" />
      <label className="sr-only" htmlFor={`capacity-${volumeSlug}-${scheduleSlug}`}>
        Capacidade de {volumeSlug} {scheduleSlug}
      </label>
      <input
        id={`capacity-${volumeSlug}-${scheduleSlug}`}
        name="capacity"
        type="number"
        min={1}
        placeholder="vagas"
        defaultValue={currentCapacity ?? ""}
        className="h-6 w-16 rounded border border-neutral-200 px-1.5 text-xs text-neutral-700 focus:border-brand-blue focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
      >
        Salvar
      </button>
      {state.error ? <span className="text-[11px] text-danger">{state.error}</span> : null}
    </form>
  );
}
