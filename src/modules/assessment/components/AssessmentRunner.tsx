"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  finalizeAssessmentAttempt,
  getAssessmentAttemptQuestions,
  submitAssessmentAnswer,
  type AssessmentAttemptQuestion,
} from "../actions/attemptActions";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Button } from "@/components/ui/Button";
import { AssessmentNavBar } from "./AssessmentNavBar";
import { AssessmentSummary } from "./AssessmentSummary";
import { PENDING_NOTICE_ID, QuestionPanel } from "./QuestionPanel";
import {
  LAST_CONFIRM_WAIT_MS,
  LOAD_NETWORK_NOTICE,
  NETWORK_NOTICE,
  SEND_NETWORK_NOTICE,
  STATE_LABEL,
  type ConfirmFailure,
  type QuestionState,
} from "./runnerState";

function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

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
  const [failure, setFailure] = useState<ConfirmFailure | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const sendingRef = useRef(false);
  const pendingRef = useRef<{ questionId: string; optionIds: string[] } | null>(null);
  const lowTimeAnnounced = useRef(false);
  const [lowTimeMessage, setLowTimeMessage] = useState("");

  // Diferença entre o relógio do servidor e o do aparelho, medida uma vez ao abrir a prova.
  const [clockOffsetMs] = useState(() => new Date(serverNow).getTime() - Date.now());
  const deadlineMs = new Date(deadlineAt).getTime();
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.floor((deadlineMs - (Date.now() + clockOffsetMs)) / 1000));

  useEffect(() => {
    let cancelled = false;
    getAssessmentAttemptQuestions(attemptId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error ?? "Não foi possível carregar as questões.");
        } else {
          const sorted = [...(res.questions ?? [])].sort((a, b) => a.position - b.position);
          setQuestions(sorted);
          setConfirmed(Object.fromEntries(sorted.map((q) => [q.questionId, q.answered])));
          // Depois de recarregar, abre onde a pessoa parou: a primeira questão ainda não confirmada.
          const firstOpen = sorted.findIndex((q) => !q.answered);
          setIndex(firstOpen === -1 ? 0 : firstOpen);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(LOAD_NETWORK_NOTICE);
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
    try {
      const res = await finalizeAssessmentAttempt(attemptId);
      // "Já encerrada" = o servidor já fechou a tentativa (ex.: tempo esgotado): o resultado está pronto.
      if (res.ok || /encerrada/i.test(res.error ?? "")) {
        router.push(`/avaliacoes/${assessmentId}/resultado`);
        return;
      }
      setSendError(res.error ?? "Não foi possível enviar agora. Suas respostas confirmadas continuam salvas. Tente de novo.");
    } catch {
      setSendError(SEND_NETWORK_NOTICE);
    }
    // Só chega aqui se o envio falhou: solta a trava para o botão de tentar de novo funcionar.
    sendingRef.current = false;
    setSending(false);
  }, [attemptId, assessmentId, router]);

  /** Tempo zerou: tenta salvar a marcação pendente (o servidor decide se ainda estava no prazo) e envia. */
  const closeByTime = useCallback(async () => {
    const pending = pendingRef.current;
    if (pending) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          submitAssessmentAnswer(attemptId, pending.questionId, pending.optionIds),
          new Promise((resolve) => {
            timer = setTimeout(resolve, LAST_CONFIRM_WAIT_MS);
          }),
        ]);
      } catch {
        // Sem rede ou fora do prazo: segue para o envio com o que já estava confirmado.
      } finally {
        clearTimeout(timer);
      }
    }
    await send();
  }, [attemptId, send]);

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
        void closeByTime();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs, clockOffsetMs, closeByTime]);

  async function handleConfirm(question: AssessmentAttemptQuestion) {
    const selected = selections[question.questionId] ?? [];
    if (selected.length === 0 || confirmingId) return;
    setConfirmingId(question.questionId);
    setFailure(null);
    try {
      const res = await submitAssessmentAnswer(attemptId, question.questionId, selected);
      if (res.ok) {
        setConfirmed((prev) => ({ ...prev, [question.questionId]: true }));
        goToNextUnconfirmed(question.questionId);
      } else if (/esgotou|encerrada/i.test(res.error ?? "")) {
        void send();
      } else {
        setFailure({ message: res.error ?? "Não foi possível confirmar a resposta.", canReload: true });
      }
    } catch {
      // Rede caiu, ou o site foi atualizado com a prova aberta e a ação do servidor mudou.
      setFailure({ message: NETWORK_NOTICE, canReload: true });
    } finally {
      setConfirmingId(null);
    }
  }

  /** Depois de confirmar, segue para a próxima questão sem confirmação; se não há, vai para o resumo. */
  function goToNextUnconfirmed(justConfirmedId: string) {
    const next = questions.findIndex((q, i) => i > index && q.questionId !== justConfirmedId && !confirmed[q.questionId]);
    if (next === -1) setView("summary");
    else setIndex(next);
  }

  function toggleOption(question: AssessmentAttemptQuestion, optionId: string) {
    setFailure(null);
    setSelections((prev) => {
      const current = prev[question.questionId] ?? [];
      if (question.selectionMode === "single") return { ...prev, [question.questionId]: [optionId] };
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [question.questionId]: next };
    });
  }

  const currentQuestion = questions[index];
  const lockedNow =
    view === "questions" &&
    Boolean(currentQuestion) &&
    !confirmed[currentQuestion!.questionId] &&
    (selections[currentQuestion!.questionId]?.length ?? 0) > 0;

  useEffect(() => {
    pendingRef.current = lockedNow ? { questionId: currentQuestion!.questionId, optionIds: selections[currentQuestion!.questionId]! } : null;
  }, [lockedNow, currentQuestion, selections]);

  // Marcação pendente se perde ao recarregar ou fechar a página: pede confirmação do navegador.
  useEffect(() => {
    if (!lockedNow) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [lockedNow]);

  if (loading) return <LoadingState label="Carregando avaliação..." />;
  if (error && questions.length === 0) {
    return (
      <Alert variant="danger">
        <div className="min-w-0">
          <p>{error}</p>
          <Button type="button" className="mt-2" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </div>
      </Alert>
    );
  }

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
  const isLowTime = remainingSeconds <= 300;
  const progressPercent = questions.length === 0 ? 0 : Math.round((confirmedCount / questions.length) * 100);

  const question = questions[index];
  // Resposta marcada e não confirmada na questão atual: nada de sair dela.
  const locked = lockedNow;

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
            {isLowTime ? " (menos de 5 minutos)" : ""}
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
      {sendError && view !== "summary" ? (
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
                disabled={sending || (locked && i !== index)}
                onClick={() => {
                  setIndex(i);
                  setView("questions");
                }}
                aria-label={`Ir para a questão ${i + 1} (${STATE_LABEL[state]})`}
                aria-current={state === "atual" ? "step" : undefined}
                className={
                  "relative size-11 rounded-full border text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue " +
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
          failure={failure}
          onToggle={(optionId) => toggleOption(question, optionId)}
          onClear={() => {
            setFailure(null);
            setSelections((prev) => ({ ...prev, [question.questionId]: [] }));
          }}
          onConfirm={() => void handleConfirm(question)}
        />
      ) : null}

      {view === "summary" ? (
        <AssessmentSummary
          items={questions.map((q) => ({ id: q.questionId, prompt: q.prompt, state: plainState(q) }))}
          sending={sending}
          sendError={sendError}
          onOpen={(i) => {
            setIndex(i);
            setView("questions");
          }}
          onBack={() => setView("questions")}
          onSend={() => void send()}
        />
      ) : null}

      {view === "questions" ? (
        <AssessmentNavBar
          index={index}
          total={questions.length}
          locked={locked}
          describedBy={PENDING_NOTICE_ID}
          onPrevious={() => setIndex(index - 1)}
          onNext={() => setIndex(index + 1)}
          onReview={() => setView("summary")}
        />
      ) : null}
    </div>
  );
}
