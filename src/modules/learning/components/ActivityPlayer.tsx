"use client";

import { useRef, useState } from "react";
import {
  beginActivityAttempt,
  checkActivityAnswer,
  loadAttemptReview,
  saveActivityAnswer,
  submitActivityAttempt,
  type ActivityQuestion,
  type SavedAnswer,
} from "../actions/activityAttempt";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ActivityResult, ActivitySummary } from "./challenge/ActivitySummary";
import { ChallengeIntro } from "./challenge/ChallengeIntro";
import { QuestionCard } from "./challenge/QuestionCard";
import { QuestionNavigator } from "./challenge/QuestionNavigator";
import type { AnswerState, SaveState } from "./challenge/types";

// "results" = tela de resultado depois de finalizar; "result" = lendo uma questão a partir dela.
type Mode = "overview" | "loading" | "playing" | "summary" | "results" | "result" | "review";

function initialAnswers(questions: ActivityQuestion[], saved: SavedAnswer[]): Record<string, AnswerState> {
  const byQuestion = new Map(saved.map((a) => [a.questionId, a]));
  return Object.fromEntries(
    questions.map((q) => {
      const s = byQuestion.get(q.questionId);
      return [q.questionId, { selected: s?.selectedOptionIds ?? [], save: s?.selectedOptionIds?.length ? "saved" : "idle", feedback: s?.feedback ?? null } as AnswerState];
    }),
  );
}

/**
 * Desafio de fixação. Toda a regra (salvar a cada escolha, verificar uma resposta por vez, enviar só com tudo
 * respondido) continua nas server actions; este componente só cuida do fluxo e da apresentação.
 */
export function ActivityPlayer({
  activityId,
  stageName = null,
  inProgress,
  last,
}: {
  activityId: string;
  /** Matéria (etapa do caminho) a que o desafio pertence. */
  stageName?: string | null;
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
    const res = kind === "review" && last ? await loadAttemptReview(last.attemptId) : await beginActivityAttempt(activityId);
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
    setMode("results");
  }

  if (mode === "loading") return <LoadingState label="Carregando o desafio..." />;

  if (mode === "overview") {
    return (
      <ChallengeIntro
        stageName={stageName}
        inProgress={inProgress}
        last={last}
        error={error}
        onStart={() => void start("play")}
        onReview={() => void start("review")}
      />
    );
  }

  if (mode === "summary") {
    return (
      <ActivitySummary
        questions={questions}
        answers={answers}
        error={error}
        busy={busy}
        onOpen={(i) => {
          setIndex(i);
          setMode("playing");
        }}
        onBack={() => setMode("playing")}
        onFinish={() => void finish()}
      />
    );
  }

  if (mode === "results" && score) {
    return (
      <ActivityResult
        questions={questions}
        answers={answers}
        score={score}
        onOpen={(i) => {
          setIndex(i);
          setMode("result");
        }}
        onRepeat={() => void start("play")}
      />
    );
  }

  const question = questions[index];
  if (!question) return <Alert variant="info">Este desafio ainda não tem questões.</Alert>;

  const answer = answers[question.questionId] ?? { selected: [], save: "idle" as SaveState, feedback: null };
  const readOnly = mode === "result" || mode === "review";
  const feedback = answer.feedback;

  return (
    <div className="flex flex-col gap-4">
      {mode === "review" && score ? (
        <Alert variant="success">
          Você acertou {score.correct} de {score.total} questões. Isso é só para fixar o conteúdo — não vale nota e não mede maturidade espiritual.
        </Alert>
      ) : null}

      {mode === "result" ? (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setMode("results")}>
            ← Voltar ao resultado
          </Button>
        </div>
      ) : null}

      <QuestionNavigator questions={questions} answers={answers} index={index} onSelect={setIndex} />

      <QuestionCard
        question={question}
        number={index + 1}
        total={questions.length}
        answer={answer}
        readOnly={readOnly}
        onChoose={(optionId) => choose(question, optionId)}
        onRetrySave={() => void persist(question, answer.selected)}
      />

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
        ) : mode === "result" ? (
          <Button onClick={() => setMode("results")}>Voltar ao resultado</Button>
        ) : readOnly ? (
          <Button onClick={() => setMode("overview")}>Concluir</Button>
        ) : (
          <Button onClick={() => setMode("summary")}>Ver resumo</Button>
        )}
      </div>
    </div>
  );
}
