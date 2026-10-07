"use client";

import { useActionState, useState } from "react";
import { bulkUpdateEnrollments, type BulkEnrollmentState } from "../actions/bulkEnrollments";
import { EnrollmentRowActions } from "./EnrollmentRowActions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";
import { enrollmentStatusValues } from "../schemas";

export interface EnrollmentTableRow {
  id: string;
  studentName: string;
  email: string | null;
  volume: string;
  className: string;
  classId: string;
  status: string;
  offeringId: string;
  classesInSameOffering: { id: string; name: string }[];
}

const selectClass = "h-9 rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 text-sm";

export function EnrollmentsTable({
  rows,
  classOptions,
}: {
  rows: EnrollmentTableRow[];
  /** Turmas de destino possíveis (todas da temporada). */
  classOptions: { id: string; name: string; offeringId: string }[];
}) {
  const [state, action, pending] = useActionState<BulkEnrollmentState, FormData>(bulkUpdateEnrollments, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"status" | "class">("status");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Turmas de destino: só as das ofertas das matrículas escolhidas (mover entre volumes é matrícula nova).
  const selectedOfferings = new Set(rows.filter((r) => selected.has(r.id)).map((r) => r.offeringId));
  const destinations = classOptions.filter((c) => selectedOfferings.size === 1 && selectedOfferings.has(c.offeringId));

  return (
    <div className="flex flex-col gap-3">
    <form
      id="bulk-enrollments"
      action={action}
      onSubmit={(event) => {
        const form = event.currentTarget;
        const data = new FormData(form);
        const what =
          mode === "status"
            ? `mudar o status de ${selected.size} matrícula(s) para "${ENROLLMENT_STATUS_LABELS[String(data.get("status"))] ?? ""}"`
            : `mover ${selected.size} matrícula(s) de turma`;
        if (!window.confirm(`Confirma ${what}? Nada é apagado — dá para desfazer pelo mesmo caminho.`)) event.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-2 text-sm">
        <span className="text-neutral-600">{selected.size} selecionada(s)</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as "status" | "class")} className={selectClass} aria-label="Tipo de ação em lote">
          <option value="status">Mudar status</option>
          <option value="class">Mover de turma</option>
        </select>
        {mode === "status" ? (
          <select name="status" defaultValue="" required className={selectClass} aria-label="Novo status">
            <option value="" disabled>
              Novo status…
            </option>
            {enrollmentStatusValues.map((value) => (
              <option key={value} value={value}>
                {ENROLLMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        ) : (
          <select name="classId" defaultValue="" required className={selectClass} aria-label="Turma de destino">
            <option value="" disabled>
              {selectedOfferings.size > 1 ? "Selecione matrículas de um só volume" : "Turma de destino…"}
            </option>
            {destinations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input type="hidden" name="action" value={mode} />
        <Button type="submit" size="sm" isLoading={pending} disabled={selected.size === 0}>
          Aplicar às selecionadas
        </Button>
      </div>
    </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            <tr>
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as matrículas desta página"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-4"
                />
              </th>
              <th className="py-2">Aluno</th>
              <th className="py-2">Volume</th>
              <th className="py-2">Turma</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Editar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="py-2">
                  <input
                    type="checkbox"
                    name="ids"
                    value={row.id}
                    form="bulk-enrollments"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Selecionar ${row.studentName}`}
                    className="size-4"
                  />
                </td>
                <td className="py-2">
                  <span className="font-medium text-neutral-900">{row.studentName}</span>
                  {row.email ? <span className="block text-xs text-neutral-500">{row.email}</span> : null}
                  {openRow === row.id ? (
                    <EnrollmentRowActions
                      enrollmentId={row.id}
                      currentStatus={row.status}
                      currentClassId={row.classId}
                      classesInSameOffering={row.classesInSameOffering}
                    />
                  ) : null}
                </td>
                <td className="py-2 text-neutral-700">{row.volume}</td>
                <td className="py-2 text-neutral-700">{row.className}</td>
                <td className="py-2 text-neutral-700">{ENROLLMENT_STATUS_LABELS[row.status] ?? row.status}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setOpenRow(openRow === row.id ? null : row.id)}
                    className="text-sm text-brand-blue hover:underline"
                  >
                    {openRow === row.id ? "Fechar" : "Editar"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-neutral-400">
                  Nenhuma matrícula neste filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
