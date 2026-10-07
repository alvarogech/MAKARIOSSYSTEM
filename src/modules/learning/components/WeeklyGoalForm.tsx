"use client";

import { useActionState, useState } from "react";
import { saveWeeklyGoal, type WeeklyGoalState } from "../actions/weeklyGoal";
import type { WeeklyGoalView } from "../weeklyGoal";
import { GOAL_MAX, GOAL_MIN } from "../weeklyGoal";
import { Button } from "@/components/ui/Button";

/** Meta semanal opcional e privada: desligada por padrão, sem aviso de falha. */
export function WeeklyGoalForm({ goal }: { goal: WeeklyGoalView }) {
  const [state, action, pending] = useActionState<WeeklyGoalState, FormData>(saveWeeklyGoal, {});
  const [enabled, setEnabled] = useState(goal.enabled);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">Meta da semana (opcional)</h3>
        {goal.enabled ? (
          <p className="text-sm text-neutral-700" aria-live="polite">
            {goal.done} de {goal.target} nesta semana{goal.reached ? " — meta alcançada" : ""}
          </p>
        ) : null}
      </div>

      {goal.enabled ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={goal.target}
          aria-valuenow={Math.min(goal.done, goal.target)}
          aria-label="Atividades feitas nesta semana"
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        >
          <div className="h-full rounded-full bg-brand-blue transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, (goal.done / goal.target) * 100)}%` }} />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-neutral-800">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-brand-blue" />
        Quero acompanhar uma meta por semana
      </label>

      {enabled ? (
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          Atividades por semana
          <select name="target" defaultValue={goal.target} className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1">
            {Array.from({ length: GOAL_MAX - GOAL_MIN + 1 }, (_, i) => GOAL_MIN + i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="target" value={goal.target} />
      )}

      <p className="text-xs text-neutral-500">
        Conta desafio enviado e prática registrada, de segunda a domingo. É só sua: ninguém da escola vê, e semana sem meta não gera aviso nem zera nada.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
          Salvar
        </Button>
        {state.error ? (
          <span role="alert" className="text-xs text-danger">
            {state.error}
          </span>
        ) : null}
        {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      </div>
    </form>
  );
}
