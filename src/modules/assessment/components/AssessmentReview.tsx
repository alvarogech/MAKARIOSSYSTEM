"use client";

import { useEffect, useState } from "react";
import {
  getAssessmentAttemptReview,
  type AssessmentReviewQuestion,
} from "../actions/attemptActions";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/feedback/LoadingState";

export function AssessmentReview({ attemptId }: { attemptId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentReviewQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAssessmentAttemptReview(attemptId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error ?? "Não foi possível carregar o gabarito.");
      } else {
        setQuestions(res.questions ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) return <LoadingState label="Carregando gabarito..." />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="flex flex-col gap-3">
      {questions.map((question) => (
        <div
          key={question.questionId}
          className="rounded-[var(--radius-sm)] border border-neutral-200 p-4"
        >
          <p className="text-xs font-medium uppercase text-neutral-400">
            Questão {question.position}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">{question.prompt}</p>

          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {question.options.map((option) => {
              const isCorrectOption = question.correctOptionIds.includes(option.optionId);
              const wasSelected = question.selectedOptionIds.includes(option.optionId);
              return (
                <li
                  key={option.optionId}
                  className={
                    isCorrectOption
                      ? "font-medium text-success"
                      : wasSelected
                        ? "text-danger"
                        : "text-neutral-600"
                  }
                >
                  {option.label}
                  {isCorrectOption ? " ✓" : wasSelected ? " (sua resposta)" : ""}
                </li>
              );
            })}
          </ul>

          <p className={`mt-2 text-xs ${question.isCorrect ? "text-success" : "text-danger"}`}>
            {question.isCorrect ? "Você acertou" : "Você errou"}
          </p>

          {question.explanation ? (
            <p className="mt-1 text-xs text-neutral-500">{question.explanation}</p>
          ) : null}
          {question.bibleReference ? (
            <p className="mt-1 text-xs text-neutral-400">{question.bibleReference}</p>
          ) : null}
        </div>
      ))}
      {questions.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma questão encontrada.</p>
      ) : null}
    </div>
  );
}
