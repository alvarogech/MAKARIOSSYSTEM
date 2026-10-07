"use client";

import { useRef, useState } from "react";
import {
  beginActivityAttempt,
  checkActivityAnswer,
  loadAttemptReview,
  saveActivityAnswer,
  submitActivityAttempt,
  type ActivityQuestion,
  type AnswerFeedback,
  type SavedAnswer,
} from "../actions/activityAttempt";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/feedback/LoadingState";

type SaveState = "idle" | "saving" | "saved" | "error";
interface AnswerState {
  selected: string[];
  save: SaveState;
  feedback: AnswerFeedback | null;
}
type Mode = "overview" | "loading" | "playing" | "summary" | "result" | "review";

function initialAnswers(questions: ActivityQuestion[], saved: SavedAnswer[]): Record<string, AnswerState> {
  const byQuestion = new Map(saved.map((a) => [a.questionId, a]));
  return Object.fromEntries(
    questions.map((q) => {
      const s = byQuestion.get(q.questionId);
      return [q.questionId, { selected: s?.selectedOptionIds ?? [], save: s?.selectedOptionIds?.length ? "saved" : "idle", feedback: s?.feedback ?? null } as AnswerState];
    }),
  );
}

export function ActivityPlayer({
  activityId,
  inProgress,
  last,
}: {
  activityId: string;
  /** Há uma tentativa começada e não enviada. */
  inProgress: boolean;
  last: { attemptId: string; correct: number; total: number } | null;
}) {
  const [mode, setMode] = useState<Mode>("overview");
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ActivityQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  // Descarta resposta de salvamento antiga quando o aluno troca de alternativa rápido.
  const saveVersion = useRef<Record<string, number>>({});

  const patch = (questionId: string, change: Partial<AnswerState>) =>
    setAnswers((previous) => ({ ...previous, [questionId]: { ...previous[questionId]!, ...change } }));

  async function start(kind: "play" | "review") {
    setMode("loading");
    setError(null);
    const res =
      kind === "review" && last ? await loadAttemptReview(last.attemptId) : await beginActivityAttempt(activityId);
    if (!res.ok || !res.questions) {
      setError(res.error ?? "Não foi possível carregar o exercício.");
      setMode("overview");
      return;
    }
    const state = initialAnswers(res.questions, res.answers ?? []);
    setAttemptId(res.attemptId ?? null);
    setQuestions(res.questions);
    setAnswers(state);
    setScore(kind === "review" && last ? { correct: last.correct, total: last.total } : null);
    const firstOpen = res.questions.findIndex((q) => !state[q.questionId]?.selected.length);
    setIndex(kind === "review" ? 0 : Math.max(0, firstOpen));
    setMode(kind === "review" ? "review" : "playing");
  }

  async function persist(question: ActivityQuestion, selected: string[]) {
    if (!attemptId) return;
    const version = (saveVersion.current[question.questionId] ?? 0) + 1;
    saveVersion.current[question.questionId] = version;
    patch(question.questionId, { selected, save: "saving" });
    const res = await saveActivityAnswer(attemptId, question.questionId, selected);
    if (saveVersion.current[question.questionId] !== version) return;
    patch(question.questionId, { save: res.ok ? "saved" : "error" });
  }

  function choose(question: ActivityQuestion, optionId: string) {
    const current = answers[question.questionId];
    if (!current || current.feedback) return;
    const next =
      question.selectionMode === "multiple"
        ? current.selected.includes(optionId)
          ? current.selected.filter((id) => id !== optionId)
          : [...current.selected, optionId]
        : [optionId];
    void persist(question, next);
  }

  async function verify(question: ActivityQuestion) {
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    const res = await checkActivityAnswer(attemptId, question.questionId);
    setBusy(false);
    if (!res.ok || !res.feedback) {
      setError(res.error ?? "Não foi possível verificar agora. Tente de novo.");
      return;
    }
    patch(question.questionId, { feedback: res.feedback });
  }

  async function finish() {
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    const res = await submitActivityAttempt(
      attemptId,
      questions.map((q) => ({ questionId: q.questionId, selectedOptionIds: answers[q.questionId]?.selected ?? [] })),
    );
    setBusy(false);
    if (!res.ok || !res.answers) {
      setError(res.error ?? "Não foi possível enviar o exercício. Suas respostas continuam salvas — tente de novo.");
      return;
    }
    setAnswers(initialAnswers(questions, res.answers));
    setScore({ correct: res.correctCount ?? 0, total: res.totalCount ?? questions.length });
    setIndex(0);
    setMode("result");
  }

  if (mode === "loading") return <LoadingState label="Carregando exercício..." />;

  if (mode === "overview") {
    return (
      <div className="flex flex-col gap-3">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {last ? (
          <Alert variant="info">
            Você concluiu este exercício: {last.correct} de {last.total} acertos na última vez. Pode revisar ou repetir
            quantas vezes quiser — não vale nota.
          </Alert>
        ) : null}
        <p className="text-sm text-neutral-600">
          Uma questão por vez. Sua resposta é salva a cada escolha, então dá para parar e continuar depois. Depois de
          responder, toque em <strong>Verificar resposta</strong> para ver a explicação e em que parte da apostila revisar.
        </p>
        <div className="flex flex-wrap gap-2">
          {inProgress ? (
            <Button onClick={() => void start("play")}>Continuar de onde parei</Button>
          ) : (
            <Button onClick={() => void start("play")}>{last ? "Repetir o exercício" : "Começar"}</Button>
          )}
          {last && !inProgress ? (
            <Button variant="secondary" onClick={() => void start("review")}>
              Rever minhas respostas
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const question = questions[index];
  const answeredAll = questions.every((q) => (answers[q.questionId]?.selected.length ?? 0) > 0);
  const anySaveProblem = questions.some((q) => answers[q.questionId]?.save === "error" || answers[q.questionId]?.save === "saving");

  if (mode === "summary") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-neutral-900">Resumo</h2>
        <ul className="flex flex-col gap-2">
          {questions.map((q, i) => {
            const a = answers[q.questionId];
            const done = (a?.selected.length ?? 0) > 0;
            return (
              <li key={q.questionId} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
                <span className="min-w-0 text-neutral-800">
                  <strong>Questão {i + 1}.</strong> <span className="line-clamp-2">{q.prompt}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={done ? "text-neutral-700" : "font-medium text-danger"}>
                    {done ? (a?.save === "error" ? "Não salva" : a?.feedback ? "Verificada" : "Respondida") : "Sem resposta"}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => { setIndex(i); setMode("playing"); }}>
                    Abrir
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {!answeredAll ? <Alert variant="warning">Responda todas as questões para finalizar.</Alert> : null}
        {anySaveProblem ? <Alert variant="warning">Alguma resposta ainda não foi salva. Volte nela e toque em “Tentar salvar de novo”.</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setMode("playing")}>
            Voltar às questões
          </Button>
          <Button onClick={() => void finish()} isLoading={busy} disabled={!answeredAll || anySaveProblem}>
            Finalizar exercício
          </Button>
        </div>
      </div>
    );
  }

  if (!question) return <Alert variant="info">Este exercício ainda não tem questões.</Alert>;

  const answer = answers[question.questionId] ?? { selected: [], save: "idle" as SaveState, feedback: null };
  const readOnly = mode === "result" || mode === "review";
  const revealed = readOnly || Boolean(answer.feedback);
  const multiple = question.selectionMode === "multiple";
  const feedback = answer.feedback;

  return (
    <div className="flex flex-col gap-4">
      {readOnly && score ? (
        <Alert variant="success">
          {mode === "result" ? "Exercício concluído! " : ""}Você acertou {score.correct} de {score.total} questões. Isso é só
          para fixar o conteúdo — não vale nota e não mede maturidade espiritual.
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="font-medium text-neutral-700" aria-live="polite">
          Questão {index + 1} de {questions.length}
        </p>
        <ol className="flex gap-1.5" aria-label="Questões">
          {questions.map((q, i) => (
            <li key={q.questionId}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir para a questão ${i + 1}${(answers[q.questionId]?.selected.length ?? 0) > 0 ? " (respondida)" : ""}`}
                aria-current={i === index ? "step" : undefined}
                className={
                  "size-8 rounded-full border text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue " +
                  (i === index
                    ? "border-brand-blue bg-brand-blue text-white"
                    : (answers[q.questionId]?.selected.length ?? 0) > 0
                      ? "border-brand-blue/40 bg-brand-blue-light text-brand-blue"
                      : "border-neutral-300 text-neutral-500")
                }
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <fieldset className="flex flex-col gap-3" disabled={readOnly || Boolean(feedback)}>
        <legend className="text-base font-medium text-neutral-900">{question.prompt}</legend>
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
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-brand-blue " +
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
                onChange={() => choose(question, option.optionId)}
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
            <button type="button" className="font-medium underline" onClick={() => void persist(question, answer.selected)}>
              Tentar salvar de novo
            </button>
          </span>
        ) : null}
      </div>

      {feedback ? (
        <div role="status" className="rounded-[var(--radius-sm)] border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className={feedback.isCorrect ? "font-semibold text-success" : "font-semibold text-danger"}>
            {feedback.isCorrect ? "✓ Você acertou." : "✗ Não foi dessa vez."}
          </p>
          {feedback.explanation ? <p className="mt-1 whitespace-pre-line text-neutral-700">{feedback.explanation}</p> : null}
          {feedback.bibleReference ? <p className="mt-1 text-neutral-500">Referência: {feedback.bibleReference}</p> : null}
        </div>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Anterior
        </Button>
        {!readOnly && !feedback ? (
          <Button
            variant="secondary"
            onClick={() => void verify(question)}
            isLoading={busy}
            disabled={answer.save !== "saved" || answer.selected.length === 0}
          >
            Verificar resposta
          </Button>
        ) : null}
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex(index + 1)}>Próxima</Button>
        ) : readOnly ? (
          <Button onClick={() => setMode("overview")}>Concluir</Button>
        ) : (
          <Button onClick={() => setMode("summary")}>Ver resumo</Button>
        )}
      </div>
    </div>
  );
}
