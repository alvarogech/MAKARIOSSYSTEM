"use client";

// Uma questão da prova: alternativas, botão principal "Confirmar resposta" e os avisos logo abaixo dele.
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { AssessmentAttemptQuestion } from "../actions/attemptActions";
import { ConfirmFailureNotice } from "./ConfirmFailureNotice";
import { PENDING_NOTICE, type ConfirmFailure } from "./runnerState";

export const PENDING_NOTICE_ID = "aviso-resposta-pendente";

export function QuestionPanel({
  question,
  total,
  selected,
  isConfirmed,
  confirming,
  disabled,
  failure,
  onToggle,
  onClear,
  onConfirm,
  onReload,
}: {
  question: AssessmentAttemptQuestion;
  total: number;
  selected: string[];
  isConfirmed: boolean;
  confirming: boolean;
  disabled: boolean;
  failure: ConfirmFailure | null;
  onToggle: (optionId: string) => void;
  onClear: () => void;
  onConfirm: () => void;
  onReload: () => void;
}) {
  const multiple = question.selectionMode === "multiple";
  const pending = !isConfirmed && selected.length > 0;
  const legendRef = useRef<HTMLLegendElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    legendRef.current?.focus();
  }, [question.questionId]);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue" aria-live="polite">
        Questão {question.position} de {total}
      </p>
      <fieldset className="flex flex-col gap-2.5" disabled={isConfirmed || disabled}>
        <legend ref={legendRef} tabIndex={-1} className="mb-1 text-base font-medium text-neutral-900 outline-none">
          {question.prompt}
        </legend>
        <p className="text-xs text-neutral-500">{multiple ? "Marque todas as alternativas corretas." : "Escolha uma alternativa."}</p>
        {question.options.map((option) => {
          const checked = selected.includes(option.optionId);
          return (
            <label
              key={option.optionId}
              className={
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-3 text-sm transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-brand-blue " +
                (checked ? "border-brand-blue bg-brand-blue-light" : "border-neutral-200 hover:border-brand-blue")
              }
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`question-${question.questionId}`}
                checked={checked}
                onChange={() => onToggle(option.optionId)}
                className="mt-0.5 size-5 shrink-0 accent-brand-blue"
              />
              <span className="min-w-0 break-words text-neutral-800">
                {option.label}
                {checked ? <span className="sr-only"> (selecionada)</span> : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {isConfirmed ? (
        <p role="status" className="text-sm text-success">
          ✓ Resposta confirmada e salva. Ela não pode mais ser alterada.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onConfirm}
            isLoading={confirming}
            disabled={selected.length === 0 || disabled}
          >
            Confirmar resposta
          </Button>
          {pending ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id={PENDING_NOTICE_ID} role="status" className="min-w-0 text-sm font-medium text-amber-800">
                {PENDING_NOTICE}
              </p>
              <Button type="button" variant="ghost" disabled={disabled} onClick={onClear}>
                Limpar marcação
              </Button>
            </div>
          ) : null}
          {failure ? <ConfirmFailureNotice failure={failure} retrying={confirming} onRetry={onConfirm} onReload={onReload} /> : null}
          <p className="text-xs text-neutral-500">
            Ao confirmar, a resposta é salva e não poderá ser alterada, e só a primeira confirmação conta. Depois de confirmar, você segue para a próxima questão. Para sair sem responder, toque em Limpar marcação.
          </p>
        </div>
      )}
    </div>
  );
}
