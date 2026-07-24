"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  finalizeAssessmentAttempt,
  getAssessmentAttemptQuestions,
  submitAssessmentAnswer,
  type AssessmentAttemptQuestion,
} from "../actions/attemptActions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/feedback/LoadingState";

function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Tela de prova: cronômetro visível (o servidor é quem de fato decide o
 * prazo — isto é só UX), progresso "X de N confirmadas" e cada questão
 * trava ao confirmar. Padrão de interação extraído do site de exercícios
 * já usado pela própria escola em temporadas anteriores.
 */
export function AssessmentRunner({
  assessmentId,
  attemptId,
  deadlineAt,
}: {
  assessmentId: string;
  attemptId: string;
  deadlineAt: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentAttemptQuestion[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000),
  );
  const [finalizing, setFinalizing] = useState(false);
  const finalizedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getAssessmentAttemptQuestions(attemptId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error ?? "Não foi possível carregar as questões.");
      } else {
        setQuestions(res.questions ?? []);
        setConfirmed(
          Object.fromEntries((res.questions ?? []).map((q) => [q.questionId, q.answered])),
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const handleFinalize = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setFinalizing(true);
    await finalizeAssessmentAttempt(attemptId);
    router.push(`/avaliacoes/${assessmentId}/resultado`);
  }, [attemptId, assessmentId, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const secondsLeft = Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000);
      setRemainingSeconds(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(interval);
        void handleFinalize();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineAt, handleFinalize]);

  async function handleConfirm(question: AssessmentAttemptQuestion) {
    const selected = selections[question.questionId] ?? [];
    if (selected.length === 0) return;

    const res = await submitAssessmentAnswer(attemptId, question.questionId, selected);
    if (res.ok) {
      setConfirmed((prev) => ({ ...prev, [question.questionId]: true }));
    } else {
      setError(res.error ?? "Não foi possível confirmar a resposta.");
    }
  }

  function toggleOption(question: AssessmentAttemptQuestion, optionId: string) {
    setSelections((prev) => {
      const current = prev[question.questionId] ?? [];
      if (question.selectionMode === "single") {
        return { ...prev, [question.questionId]: [optionId] };
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [question.questionId]: next };
    });
  }

  if (loading) return <LoadingState label="Carregando avaliação..." />;
  if (error && questions.length === 0) return <Alert variant="danger">{error}</Alert>;

  const confirmedCount = Object.values(confirmed).filter(Boolean).length;
  const isLowTime = remainingSeconds <= 300;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`sticky top-0 z-10 flex items-center justify-between rounded-[var(--radius-sm)] border p-3 text-sm ${
          isLowTime ? "border-danger/40 bg-danger/10" : "border-brand-blue/30 bg-brand-blue-light"
        }`}
      >
        <span className="font-medium">TEMPO RESTANTE {formatRemaining(remainingSeconds)}</span>
        <span className="text-neutral-600">
          {confirmedCount} de {questions.length} confirmadas
        </span>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex flex-col gap-4">
        {questions.map((question) => {
          const isConfirmed = confirmed[question.questionId];
          const selected = selections[question.questionId] ?? [];

          return (
            <div
              key={question.questionId}
              className="rounded-[var(--radius-sm)] border border-neutral-200 p-4"
            >
              <p className="text-xs font-medium uppercase text-neutral-400">
                Questão {question.position} ·{" "}
                {question.selectionMode === "multiple" ? "Marque todas as corretas" : "Uma resposta correta"}
              </p>
              <p className="mt-1 text-sm font-medium text-neutral-800">{question.prompt}</p>

              <div className="mt-3 flex flex-col gap-1.5">
                {question.options.map((option) => (
                  <label key={option.optionId} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type={question.selectionMode === "multiple" ? "checkbox" : "radio"}
                      name={`question-${question.questionId}`}
                      checked={selected.includes(option.optionId)}
                      disabled={isConfirmed}
                      onChange={() => toggleOption(question, option.optionId)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>

              {isConfirmed ? (
                <p className="mt-3 text-xs text-success">Resposta confirmada.</p>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleConfirm(question)}
                  disabled={selected.length === 0}
                >
                  Confirmar resposta
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        isLoading={finalizing}
        onClick={handleFinalize}
        className="self-start"
      >
        Finalizar avaliação
      </Button>
      <p className="text-xs text-neutral-400">
        Somente a primeira resposta confirmada de cada questão é considerada.
      </p>
    </div>
  );
}
