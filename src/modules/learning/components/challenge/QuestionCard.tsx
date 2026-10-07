"use client";

import { useEffect, useRef } from "react";
import type { ActivityQuestion } from "../../actions/activityAttempt";
import type { AnswerState } from "./types";

/** Uma questão: enunciado, alternativas, estado do salvamento e, depois de verificar, a explicação. */
export function QuestionCard({
  question,
  number,
  total,
  answer,
  readOnly,
  onChoose,
  onRetrySave,
}: {
  question: ActivityQuestion;
  number: number;
  total: number;
  answer: AnswerState;
  readOnly: boolean;
  onChoose: (optionId: string) => void;
  onRetrySave: () => void;
}) {
  const feedback = answer.feedback;
  const revealed = readOnly || Boolean(feedback);
  const multiple = question.selectionMode === "multiple";

  // Ao trocar de questão o foco vai para o enunciado, para quem usa leitor de tela ou teclado.
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
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue" aria-live="polite">
        Questão {number} de {total}
      </p>

      <fieldset className="flex flex-col gap-3" disabled={readOnly || Boolean(feedback)}>
        <legend ref={legendRef} tabIndex={-1} className="text-base font-medium text-neutral-900 outline-none">
          {question.prompt}
        </legend>
        <p className="text-xs text-neutral-500">
          {multiple
            ? "Marque todas as alternativas corretas. A questão só conta se você marcar exatamente o conjunto certo — não há pontuação parcial."
            : "Escolha uma alternativa."}
        </p>
        {question.options.map((option) => {
          const checked = answer.selected.includes(option.optionId);
          const isRight = feedback?.correctOptionIds.includes(option.optionId) ?? false;
          return (
            <label
              key={option.optionId}
              className={
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-3 text-sm transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-brand-blue " +
                (revealed && isRight
                  ? "border-success bg-success/5"
                  : checked
                    ? "border-brand-blue bg-brand-blue-light"
                    : "border-neutral-200 hover:border-brand-blue")
              }
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`q-${question.questionId}`}
                value={option.optionId}
                checked={checked}
                onChange={() => onChoose(option.optionId)}
                className="mt-0.5 size-5 shrink-0 accent-brand-blue"
              />
              <span className="min-w-0 break-words text-neutral-800">
                {option.label}
                {revealed && isRight ? <strong className="ml-2 text-success">✓ Resposta correta</strong> : null}
                {revealed && checked && !isRight ? <strong className="ml-2 text-danger">✗ Sua escolha</strong> : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div aria-live="polite" className="min-h-5 text-xs">
        {!readOnly && answer.save === "saving" ? <span className="text-neutral-500">Salvando...</span> : null}
        {!readOnly && answer.save === "saved" ? <span className="text-neutral-500">Resposta salva.</span> : null}
        {!readOnly && answer.save === "error" ? (
          <span role="alert" className="text-danger">
            Resposta ainda não salva.{" "}
            <button type="button" className="font-medium underline" onClick={onRetrySave}>
              Tentar salvar de novo
            </button>
          </span>
        ) : null}
      </div>

      {feedback ? (
        <div role="status" className="rounded-[var(--radius-sm)] border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className={feedback.isCorrect ? "font-semibold text-success" : "font-semibold text-neutral-800"}>
            {feedback.isCorrect ? "✓ Você acertou." : "Ainda não foi dessa vez — veja a explicação."}
          </p>
          {feedback.explanation ? <p className="mt-1 whitespace-pre-line text-neutral-700">{feedback.explanation}</p> : null}
          {feedback.bibleReference ? <p className="mt-1 text-neutral-500">Referência: {feedback.bibleReference}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
