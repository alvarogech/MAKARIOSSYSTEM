"use client";

import { useActionState } from "react";
import { setReportRequirement, type ReportRequirementState } from "../actions/setReportRequirement";

/** Interruptor "Exigir relatório pós-aula dos professores" de um semestre. */
export function ReportSwitch({
  seasonId,
  seasonName,
  enabled,
  changedLabel,
}: {
  seasonId: string;
  seasonName: string;
  enabled: boolean;
  changedLabel: string | null;
}) {
  const [state, action, pending] = useActionState<ReportRequirementState, FormData>(setReportRequirement, {});
  const labelId = `report-switch-${seasonId}`;

  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-3">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-sm font-medium text-neutral-900">
          Exigir relatório pós-aula dos professores · {seasonName}
        </span>
        <button
          type="submit"
          role="switch"
          aria-checked={enabled}
          aria-labelledby={labelId}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60 ${
            enabled ? "border-brand-blue bg-brand-blue" : "border-neutral-300 bg-neutral-200"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
          <span className="sr-only">{enabled ? "Ligado" : "Desligado"}</span>
        </button>
      </div>
      <p className="text-xs text-neutral-500">Quando desligado, o relatório não aparece para os professores e não gera pendências.</p>
      <p className="text-xs text-neutral-400">{changedLabel ?? "Nunca alterado (desligado por padrão)."}</p>
      <p aria-live="polite" className="min-h-4 text-xs">
        {state.error ? <span className="text-danger">{state.error}</span> : null}
        {state.success ? <span className="text-success">{state.success}</span> : null}
      </p>
    </form>
  );
}
