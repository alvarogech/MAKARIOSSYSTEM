"use client";

import { useEffect, useState } from "react";
import {
  beginActivityAttempt,
  submitActivityAttempt,
  type ActivityQuestion,
  type SubmitActivityAttemptResult,
} from "../actions/activityAttempt";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/feedback/LoadingState";

export function ActivityRunner({ activityId }: { activityId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [questions, setQuestions] = useState<ActivityQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitActivityAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    beginActivityAttempt(activityId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error ?? "Não foi possível iniciar o exercício.");
      } else {
        setAttemptId(res.attemptId ?? null);
        setAlreadySubmitted(Boolean(res.alreadySubmitted));
        setQuestions(res.questions ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  async function handleSubmit() {
    if (!attemptId) return;
    setSubmitting(true);
    setError(null);

    const payload = questions.map((q) => {
      const selected = answers[q.questionId];
      return {
        questionId: q.questionId,
        selectedOptionIds: selected ? [selected] : [],
      };
    });

    const res = await submitActivityAttempt(attemptId, payload);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Não foi possível enviar o exercício.");
      return;
    }

    setResult(res);
  }

  if (loading) return <LoadingState label="Carregando exercício..." />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (alreadySubmitted && !result) {
    return <Alert variant="info">Você já enviou este exercício.</Alert>;
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="success">
          Você acertou {result.correctCount} de {result.totalCount} questões. O
          exercício não vale nota — é só para fixação.
        </Alert>
        {result.showFeedback ? (
          <ul className="flex flex-col gap-2">
            {(result.answers ?? []).map((answer) => {
              const question = questions.find((q) => q.questionId === answer.questionId);
              return (
                <li
                  key={answer.questionId}
                  className="rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm"
                >
                  <p className="font-medium text-neutral-800">{question?.prompt}</p>
                  <p className={answer.isCorrect ? "text-success" : "text-danger"}>
                    {answer.isCorrect ? "Correto" : "Incorreto"}
                  </p>
                  {answer.explanation ? (
                    <p className="mt-1 text-neutral-500">{answer.explanation}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((question) => (
        <div key={question.questionId} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3">
          <p className="mb-2 text-sm font-medium text-neutral-800">{question.prompt}</p>
          <div className="flex flex-col gap-1.5">
            {question.options.map((option) => (
              <label key={option.optionId} className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="radio"
                  name={`question-${question.questionId}`}
                  value={option.optionId}
                  checked={answers[question.questionId] === option.optionId}
                  onChange={() =>
                    setAnswers((prev) => ({ ...prev, [question.questionId]: option.optionId }))
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      {questions.length === 0 ? (
        <p className="text-sm text-neutral-400">Este exercício ainda não tem questões.</p>
      ) : (
        <Button onClick={handleSubmit} isLoading={submitting} className="self-start">
          Enviar respostas
        </Button>
      )}
    </div>
  );
}
