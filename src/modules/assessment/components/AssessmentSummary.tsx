"use client";

// Tela "Revisar e enviar": situação de cada questão, avisos e o envio definitivo.
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { STATE_LABEL, type QuestionState } from "./runnerState";

export interface SummaryItem {
  id: string;
  prompt: string;
  state: Exclude<QuestionState, "atual">;
}

export function AssessmentSummary({
  items,
  sending,
  sendError,
  onOpen,
  onBack,
  onSend,
}: {
  items: SummaryItem[];
  sending: boolean;
  sendError: string | null;
  onOpen: (index: number) => void;
  onBack: () => void;
  onSend: () => void;
}) {
  const unconfirmedCount = items.filter((i) => i.state === "selecionada").length;
  const emptyCount = items.filter((i) => i.state === "sem_resposta").length;
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold text-neutral-900">Revisar e enviar</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-2.5">
            <span className="min-w-0 text-neutral-800">
              <strong>Questão {i + 1}.</strong> <span className="line-clamp-1">{item.prompt}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={item.state === "confirmada" ? "text-success" : item.state === "selecionada" ? "text-amber-700" : "font-medium text-danger"}>
                {STATE_LABEL[item.state][0]!.toUpperCase() + STATE_LABEL[item.state].slice(1)}
              </span>
              {item.state !== "confirmada" ? (
                <Button size="md" variant="ghost" disabled={sending} onClick={() => onOpen(i)} aria-label={`Voltar à questão ${i + 1}`}>
                  Abrir
                </Button>
              ) : null}
            </span>
          </li>
        ))}
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
        <Button variant="secondary" disabled={sending} onClick={onBack}>
          Voltar às questões
        </Button>
        <Button isLoading={sending} onClick={onSend}>
          Enviar avaliação
        </Button>
      </div>
      {sendError ? (
        <Alert variant="danger">
          <div className="min-w-0">
            <p>{sendError}</p>
            <Button type="button" variant="secondary" className="mt-2" isLoading={sending} onClick={onSend}>
              Tentar enviar de novo
            </Button>
          </div>
        </Alert>
      ) : null}
      {sending ? <p className="text-xs text-neutral-500" aria-live="polite">Enviando… aguarde a confirmação.</p> : null}
    </div>
  );
}
