"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { bulkReviewEnrollmentRequests } from "../actions/bulkReviewEnrollmentRequests";
import { ENROLLMENT_STATUS_LABELS, type EnrollmentRequestStatus } from "../types";

const ACTIONABLE_STATUSES: EnrollmentRequestStatus[] = ["approved", "rejected", "cancelled", "pending"];

/**
 * Barra de ações em lote — só aparece quando há alguma inscrição
 * selecionada. Confirmação nativa do navegador (`window.confirm`) antes de
 * qualquer mudança de status, mostrando quantidade e ação; depois de
 * aplicar, limpa só a seleção já processada e deixa filtros/página como
 * estavam (o `router.refresh()` do tempo real já cuida de atualizar
 * cards/gráfico/tabela).
 */
export function EnrollmentBulkActionsBar({
  selectedIds,
  onClearSelection,
  onSelectAllFiltered,
  totalFilteredCount,
  selectionLoading,
}: {
  selectedIds: string[];
  onClearSelection: () => void;
  onSelectAllFiltered: () => void;
  totalFilteredCount: number;
  selectionLoading: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ variant: "success" | "danger" | "warning"; message: string } | null>(
    null,
  );

  if (selectedIds.length === 0) return null;

  function applyStatus(status: EnrollmentRequestStatus) {
    const label = ENROLLMENT_STATUS_LABELS[status];
    const confirmed = window.confirm(
      `${label === "Aprovada" ? "Aprovar" : `Marcar como "${label}"`} ${selectedIds.length} inscrições selecionadas?`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await bulkReviewEnrollmentRequests(selectedIds, status);
      if (result.error) {
        setFeedback({ variant: "danger", message: result.error });
      } else if (result.warning) {
        setFeedback({ variant: "warning", message: result.warning });
      } else {
        setFeedback({ variant: "success", message: `${result.updatedCount ?? selectedIds.length} inscrições atualizadas.` });
      }
      onClearSelection();
      router.refresh();
    });
  }

  const exportHref = `/coordenacao/inscricoes/export?ids=${selectedIds.join(",")}`;

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-brand-blue/30 bg-brand-blue-light p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-neutral-700">
          <span className="font-semibold">{selectedIds.length} selecionada{selectedIds.length === 1 ? "" : "s"}</span>
          {totalFilteredCount > selectedIds.length ? (
            <button
              type="button"
              onClick={onSelectAllFiltered}
              disabled={selectionLoading}
              className="text-xs font-medium text-brand-blue underline hover:no-underline disabled:opacity-50"
            >
              {selectionLoading ? "Carregando…" : `Selecionar todos os ${totalFilteredCount} resultados do filtro`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
          >
            <X className="size-3.5" aria-hidden="true" />
            Limpar seleção
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Exportar selecionados
          </a>
          {ACTIONABLE_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={status === "approved" ? "primary" : status === "rejected" ? "danger" : "secondary"}
              isLoading={isPending}
              onClick={() => applyStatus(status)}
            >
              {status === "pending" ? "Voltar p/ pendente" : ENROLLMENT_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </div>

      {feedback ? <Alert variant={feedback.variant}>{feedback.message}</Alert> : null}
    </div>
  );
}
