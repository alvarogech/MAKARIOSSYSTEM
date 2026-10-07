import { Check, Clock, ListChecks, Save } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Abertura do desafio de fixação: o que é, como funciona e o botão para começar, continuar ou rever. */
export function ChallengeIntro({
  stageName,
  inProgress,
  last,
  error,
  onStart,
  onReview,
}: {
  /** Nome da matéria (a etapa do caminho a que este desafio pertence). */
  stageName: string | null;
  inProgress: boolean;
  last: { attemptId: string; correct: number; total: number } | null;
  error: string | null;
  onStart: () => void;
  onReview: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {last ? (
        <Alert variant="info">
          Você já concluiu este desafio: {last.correct} de {last.total} acertos na última vez. Pode rever ou repetir quantas vezes
          quiser — não vale nota.
        </Alert>
      ) : null}

      {stageName ? <p className="text-sm text-neutral-600">Etapa do seu caminho: <strong>{stageName}</strong></p> : null}

      <ul className="grid gap-2 text-sm text-neutral-700 sm:grid-cols-3">
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>Uma questão por vez, no seu ritmo.</span>
        </li>
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <Save className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>Cada resposta é salva sozinha — dá para parar e voltar.</span>
        </li>
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <Check className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>Depois de responder, verifique para ver a explicação e onde revisar.</span>
        </li>
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Clock className="size-3.5" aria-hidden="true" /> Sem cronômetro e sem nota: serve para fixar o que você estudou.
      </p>

      <div className="flex flex-wrap gap-2">
        {inProgress ? <Button onClick={onStart}>Continuar de onde parei</Button> : <Button onClick={onStart}>{last ? "Repetir o desafio" : "Começar o desafio"}</Button>}
        {last && !inProgress ? (
          <Button variant="secondary" onClick={onReview}>
            Rever minhas respostas
          </Button>
        ) : null}
      </div>
    </div>
  );
}
