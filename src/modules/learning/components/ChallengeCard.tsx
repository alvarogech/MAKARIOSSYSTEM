"use client";

import { useActionState } from "react";
import { practiceChallenge, type ChallengeState } from "../actions/challengeCompletion";
import { Button } from "@/components/ui/Button";

export function ChallengeCard({
  enrollmentId,
  challengeId,
  prompt,
  practiced,
  note,
}: {
  enrollmentId: string;
  challengeId: string;
  prompt: string;
  practiced: boolean;
  note: string;
}) {
  const [state, action, pending] = useActionState<ChallengeState, FormData>(practiceChallenge, {});
  const isPracticed = state.practiced ?? practiced;

  return (
    <div className="rounded-[var(--radius-sm)] border border-neutral-200 p-3">
      <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Desafio prático · sem nota</p>
      <p className="mt-1 whitespace-pre-line text-sm text-neutral-800">{prompt}</p>

      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="challengeId" value={challengeId} />

        {isPracticed ? (
          <>
            <label htmlFor={`note-${challengeId}`} className="text-xs font-medium text-neutral-600">
              Nota privada (opcional) — só você vê, nem professores nem coordenação
            </label>
            <textarea
              id={`note-${challengeId}`}
              name="note"
              defaultValue={note}
              maxLength={2000}
              rows={3}
              className="w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" name="intent" value="note" size="sm" variant="secondary" isLoading={pending}>
                Guardar nota
              </Button>
              <Button type="submit" name="intent" value="undo" size="sm" variant="ghost" disabled={pending}>
                Desmarcar
              </Button>
              <span className="text-sm font-medium text-success" role="status">
                ✓ Marcado como praticado{state.saved ? " · nota guardada" : ""}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" name="intent" value="practice" size="sm" isLoading={pending}>
              Pratiquei
            </Button>
            <span className="text-xs text-neutral-500">Basta marcar — você não precisa escrever nada.</span>
          </div>
        )}
        {state.error ? (
          <p role="alert" className="text-xs text-danger">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
