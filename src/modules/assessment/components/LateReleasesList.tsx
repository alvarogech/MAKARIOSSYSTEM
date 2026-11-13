// Lista das liberações fora do prazo: até quando vale e quem liberou (cartões, sem tabela, para o celular).
import type { LateReleaseRow } from "../lateReleaseRows";

export function LateReleasesList({
  rows,
  assessmentLabelById,
}: {
  rows: LateReleaseRow[];
  assessmentLabelById: Record<string, string>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-400">Nenhuma liberação dada ainda.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words font-medium text-neutral-900">{row.studentName}</span>
            <span className={row.active ? "font-medium text-success" : "text-neutral-500"}>
              {row.active ? `Vale até ${row.validUntilLabel}` : `Venceu em ${row.validUntilLabel}`}
            </span>
          </div>
          <p className="mt-1 break-words text-neutral-600">{assessmentLabelById[row.assessmentId] ?? "Avaliação"}</p>
          <p className="mt-1 break-words text-xs text-neutral-500">
            Liberada por {row.grantedByName}. Motivo: {row.reason}
          </p>
        </li>
      ))}
    </ul>
  );
}
