import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonVariants } from "@/components/ui/Button";
import type { ActivityQuestion } from "../../actions/activityAttempt";
import type { AnswerState } from "./types";

/** Conferência antes de finalizar: o aluno vê o que falta e abre qualquer questão. */
export function ActivitySummary({
  questions,
  answers,
  error,
  busy,
  onOpen,
  onBack,
  onFinish,
}: {
  questions: ActivityQuestion[];
  answers: Record<string, AnswerState>;
  error: string | null;
  busy: boolean;
  onOpen: (index: number) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const answeredAll = questions.every((q) => (answers[q.questionId]?.selected.length ?? 0) > 0);
  const anySaveProblem = questions.some((q) => answers[q.questionId]?.save === "error" || answers[q.questionId]?.save === "saving");
  const missing = questions.filter((q) => (answers[q.questionId]?.selected.length ?? 0) === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Antes de finalizar</h2>
        <p className="text-sm text-neutral-500">
          {missing === 0
            ? "Todas as questões estão respondidas. Confira e finalize quando quiser."
            : `Falta responder ${missing} ${missing === 1 ? "questão" : "questões"}.`}
        </p>
      </div>
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
                <Button size="sm" variant="ghost" onClick={() => onOpen(i)} aria-label={`Abrir a questão ${i + 1}`}>
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
        <Button variant="secondary" onClick={onBack}>
          Voltar às questões
        </Button>
        <Button onClick={onFinish} isLoading={busy} disabled={!answeredAll || anySaveProblem}>
          Finalizar desafio
        </Button>
      </div>
    </div>
  );
}

/** Tela de resultado depois de finalizar: o que foi acertado, o que vale rever e para onde seguir. */
export function ActivityResult({
  questions,
  answers,
  score,
  onOpen,
  onRepeat,
}: {
  questions: ActivityQuestion[];
  answers: Record<string, AnswerState>;
  score: { correct: number; total: number };
  onOpen: (index: number) => void;
  onRepeat: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="rounded-[var(--radius-lg)] border border-success/30 bg-success/5 p-4">
        <h2 className="text-base font-semibold text-neutral-900">Desafio concluído</h2>
        <p className="mt-1 text-sm text-neutral-700">
          Você acertou {score.correct} de {score.total} {score.total === 1 ? "questão" : "questões"}. Isso é só para fixar o conteúdo — não vale nota e não mede
          maturidade espiritual.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Suas questões</h3>
        <p className="text-xs text-neutral-500">Abra qualquer uma para ler a explicação e ver onde revisar na apostila.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {questions.map((q, i) => {
          const right = answers[q.questionId]?.feedback?.isCorrect;
          return (
            <li key={q.questionId} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
              <span className="min-w-0 text-neutral-800">
                <strong>Questão {i + 1}.</strong> <span className="line-clamp-2">{q.prompt}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={right ? "font-medium text-success" : "font-medium text-neutral-700"}>{right ? "✓ Acertou" : "Vale rever"}</span>
                <Button size="sm" variant="ghost" onClick={() => onOpen(i)} aria-label={`Ver a questão ${i + 1}`}>
                  Ver
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard" className={buttonVariants({ variant: "primary" })}>
          Voltar ao meu caminho
        </Link>
        <Button variant="secondary" onClick={onRepeat}>
          Repetir o desafio
        </Button>
      </div>
    </div>
  );
}
