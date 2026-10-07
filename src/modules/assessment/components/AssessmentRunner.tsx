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

type QuestionState = "atual" | "confirmada" | "selecionada" | "sem_resposta";

/**
 * Prova como etapa de síntese: uma questão por vez, navegação numerada, resumo antes do envio.
 * As regras não mudam e continuam no servidor: o prazo é o `deadline_at` da tentativa (calculado no banco,
 * não reinicia ao recarregar), só a primeira resposta confirmada de cada questão conta, e nenhum acerto ou
 * erro aparece antes do envio. Aqui só há apresentação e fluxo.
 */
export function AssessmentRunner({
  assessmentId,
  attemptId,
  deadlineAt,
  serverNow,
}: {
  assessmentId: string;
  attemptId: string;
  deadlineAt: string;
  /** Hora do servidor no momento em que a página foi montada — o relógio do aparelho não decide o prazo. */
  serverNow: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentAttemptQuestion[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"questions" | "summary">("questions");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const sendingRef = useRef(false);
  const lowTimeAnnounced = useRef(false);
  const [lowTimeMessage, setLowTimeMessage] = useState("");

  // Diferença entre o relógio do servidor e o do aparelho, medida uma vez ao abrir a prova.
  const [clockOffsetMs] = useState(() => new Date(serverNow).getTime() - Date.now());
  const deadlineMs = new Date(deadlineAt).getTime();
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.floor((deadlineMs - (Date.now() + clockOffsetMs)) / 1000));

  useEffect(() => {
    let cancelled = false;
    getAssessmentAttemptQuestions(attemptId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error ?? "Não foi possível carregar as questões.");
      } else {
        const sorted = [...(res.questions ?? [])].sort((a, b) => a.position - b.position);
        setQuestions(sorted);
        setConfirmed(Object.fromEntries(sorted.map((q) => [q.questionId, q.answered])));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    const res = await finalizeAssessmentAttempt(attemptId);
    // "Já encerrada" = o servidor já fechou a tentativa (ex.: tempo esgotado): o resultado está pronto.
    if (res.ok || /encerrada/i.test(res.error ?? "")) {
      router.push(`/avaliacoes/${assessmentId}/resultado`);
      return;
    }
    sendingRef.current = false;
    setSending(false);
    setSendError(res.error ?? "Não foi possível enviar agora. Suas respostas confirmadas continuam salvas — tente de novo.");
  }, [attemptId, assessmentId, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.floor((deadlineMs - (Date.now() + clockOffsetMs)) / 1000);
      setRemainingSeconds(left);
      if (left <= 300 && left > 0 && !lowTimeAnnounced.current) {
        lowTimeAnnounced.current = true;
        setLowTimeMessage("Restam menos de 5 minutos.");
      }
      if (left <= 0) {
        clearInterval(interval);
        setTimeUp(true);
        void send();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs, clockOffsetMs, send]);

  async function handleConfirm(question: AssessmentAttemptQuestion) {
    const selected = selections[question.questionId] ?? [];
    if (selected.length === 0 || confirmingId) return;
    setConfirmingId(question.questionId);
    setError(null);
    const res = await submitAssessmentAnswer(attemptId, question.questionId, selected);
    setConfirmingId(null);
    if (res.ok) {
      setConfirmed((prev) => ({ ...prev, [question.questionId]: true }));
    } else if (/esgotou|encerrada/i.test(res.error ?? "")) {
      void send();
    } else {
      setError(res.error ?? "Não foi possível confirmar a resposta.");
    }
  }

  function toggleOption(question: AssessmentAttemptQuestion, optionId: string) {
    setSelections((prev) => {
      const current = prev[question.questionId] ?? [];
      if (question.selectionMode === "single") return { ...prev, [question.questionId]: [optionId] };
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [question.questionId]: next };
    });
  }

  if (loading) return <LoadingState label="Carregando avaliação..." />;
  if (error && questions.length === 0) return <Alert variant="danger">{error}</Alert>;

  const stateOf = (question: AssessmentAttemptQuestion, i: number): QuestionState =>
    i === index && view === "questions"
      ? "atual"
      : confirmed[question.questionId]
        ? "confirmada"
        : (selections[question.questionId]?.length ?? 0) > 0
          ? "selecionada"
          : "sem_resposta";
  const plainState = (question: AssessmentAttemptQuestion): Exclude<QuestionState, "atual"> =>
    confirmed[question.questionId] ? "confirmada" : (selections[question.questionId]?.length ?? 0) > 0 ? "selecionada" : "sem_resposta";

  const confirmedCount = questions.filter((q) => confirmed[q.questionId]).length;
  const unconfirmedCount = questions.filter((q) => plainState(q) === "selecionada").length;
  const emptyCount = questions.filter((q) => plainState(q) === "sem_resposta").length;
  const isLowTime = remainingSeconds <= 300;
  const progressPercent = questions.length === 0 ? 0 : Math.round((confirmedCount / questions.length) * 100);

  const STATE_LABEL: Record<QuestionState, string> = {
    atual: "questão atual",
    confirmada: "resposta confirmada",
    selecionada: "marcada, falta confirmar",
    sem_resposta: "sem resposta",
  };

  const question = questions[index];

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`sticky top-0 z-10 flex flex-col gap-2 rounded-[var(--radius-sm)] border p-3 text-sm ${
          isLowTime ? "border-danger/40 bg-danger/10" : "border-brand-blue/30 bg-brand-blue-light"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span role="timer" className="font-medium">
            Tempo restante {formatRemaining(remainingSeconds)}
            {isLowTime ? " — menos de 5 minutos" : ""}
          </span>
          <span className="text-neutral-700">
            {confirmedCount} de {questions.length} respondidas
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={confirmedCount}
          aria-label="Respostas confirmadas (mede o andamento, não o desempenho)"
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/70"
        >
          <div className="h-full rounded-full bg-brand-blue transition-[width] motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="sr-only" aria-live="polite">
          {lowTimeMessage}
        </span>
      </div>

      {timeUp ? <Alert variant="info">O tempo acabou. Estamos enviando as respostas que você confirmou…</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {sendError ? (
        <Alert variant="danger">
          {sendError}{" "}
          <button type="button" className="font-medium underline" onClick={() => void send()}>
            Tentar enviar de novo
          </button>
        </Alert>
      ) : null}

      <ol className="flex flex-wrap gap-1.5" aria-label="Questões da avaliação">
        {questions.map((q, i) => {
          const state = stateOf(q, i);
          return (
            <li key={q.questionId}>
              <button
                type="button"
                disabled={sending}
                onClick={() => {
                  setIndex(i);
                  setView("questions");
                }}
                aria-label={`Ir para a questão ${i + 1} (${STATE_LABEL[state]})`}
                aria-current={state === "atual" ? "step" : undefined}
                className={
                  "relative size-9 rounded-full border text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue " +
                  (state === "atual"
                    ? "border-brand-blue bg-brand-blue text-white"
                    : state === "confirmada"
                      ? "border-success/50 bg-success/10 text-success"
                      : state === "selecionada"
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-neutral-300 text-neutral-500")
                }
              >
                {i + 1}
                {state === "confirmada" ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 text-[10px] leading-none">✓</span> : null}
                {state === "selecionada" ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 text-[10px] leading-none">•</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-neutral-500">
        ✓ confirmada · • marcada, falta confirmar · sem marca = sem resposta
      </p>

      {view === "questions" && question ? (
        <QuestionPanel
          question={question}
          total={questions.length}
          selected={selections[question.questionId] ?? []}
          isConfirmed={Boolean(confirmed[question.questionId])}
          confirming={confirmingId === question.questionId}
          disabled={sending}
          onToggle={(optionId) => toggleOption(question, optionId)}
          onConfirm={() => void handleConfirm(question)}
        />
      ) : null}

      {view === "summary" ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold text-neutral-900">Revisar e enviar</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {questions.map((q, i) => {
              const state = plainState(q);
              return (
                <li key={q.questionId} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-2.5">
                  <span className="min-w-0 text-neutral-800">
                    <strong>Questão {i + 1}.</strong> <span className="line-clamp-1">{q.prompt}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={state === "confirmada" ? "text-success" : state === "selecionada" ? "text-amber-700" : "font-medium text-danger"}>
                      {STATE_LABEL[state][0]!.toUpperCase() + STATE_LABEL[state].slice(1)}
                    </span>
                    {state !== "confirmada" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={sending}
                        onClick={() => {
                          setIndex(i);
                          setView("questions");
                        }}
                        aria-label={`Voltar à questão ${i + 1}`}
                      >
                        Abrir
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

          {unconfirmedCount > 0 ? (
            <Alert variant="warning">
              {unconfirmedCount} {unconfirmedCount === 1 ? "questão tem uma resposta marcada, mas não confirmada" : "questões têm respostas marcadas, mas não confirmadas"}. Resposta não confirmada não é salva e não conta.
            </Alert>
          ) : null}
          {emptyCount > 0 ? (
            <Alert variant="info">
              {emptyCount} {emptyCount === 1 ? "questão está sem resposta" : "questões estão sem resposta"}. Você pode enviar assim, mas elas não pontuam.
            </Alert>
          ) : null}
          <Alert variant="warning">O envio é definitivo: depois dele você não poderá alterar nenhuma resposta.</Alert>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={sending} onClick={() => setView("questions")}>
              Voltar às questões
            </Button>
            <Button isLoading={sending} onClick={() => void send()}>
              Enviar avaliação
            </Button>
          </div>
          {sending ? <p className="text-xs text-neutral-500" aria-live="polite">Enviando… aguarde a confirmação.</p> : null}
        </div>
      ) : null}

      {view === "questions" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Anterior
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)}>Próxima</Button>
          ) : (
            <Button onClick={() => setView("summary")}>Revisar e enviar</Button>
          )}
          {index < questions.length - 1 ? (
            <Button variant="ghost" onClick={() => setView("summary")}>
              Revisar e enviar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuestionPanel({
  question,
  total,
  selected,
  isConfirmed,
  confirming,
  disabled,
  onToggle,
  onConfirm,
}: {
  question: AssessmentAttemptQuestion;
  total: number;
  selected: string[];
  isConfirmed: boolean;
  confirming: boolean;
  disabled: boolean;
  onToggle: (optionId: string) => void;
  onConfirm: () => void;
}) {
  const multiple = question.selectionMode === "multiple";
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
        <div className="flex flex-col gap-1.5">
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={onConfirm} isLoading={confirming} disabled={selected.length === 0 || disabled}>
              Confirmar resposta
            </Button>
          </div>
          <p className="text-xs text-neutral-500">
            Ao confirmar, a resposta é salva e não poderá ser alterada — só a primeira confirmação conta. Resposta marcada e não confirmada não é salva.
          </p>
        </div>
      )}
    </div>
  );
}
