"use client";

import { useActionState } from "react";
import {
  importStudents,
  type ImportStudentsState,
} from "../actions/importStudents";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: ImportStudentsState = {};

function downloadErrorsCsv(state: ImportStudentsState) {
  if (!state.report) return;

  const errorRows = state.report.rows.filter((row) => row.status === "error");
  const header = "linha,nome,email,erros\n";
  const body = errorRows
    .map((row) => {
      const errors = row.errors.join(" | ").replaceAll('"', "'");
      return `${row.rowNumber},"${row.fullName ?? ""}","${row.email ?? ""}","${errors}"`;
    })
    .join("\n");

  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `erros-${state.report.fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportStudentsForm() {
  const [state, formAction, isPending] = useActionState(
    importStudents,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

        <div>
          <Label htmlFor="file">Planilha (.csv ou .xlsx)</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls"
            required
            className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-brand-blue-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-blue-dark"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Cabeçalhos esperados na primeira linha: nome, email, telefone,
            nascimento, volume, temporada, turma.
          </p>
        </div>

        <Button type="submit" isLoading={isPending} className="self-start">
          Importar
        </Button>
      </form>

      {state.report ? (
        <div className="flex flex-col gap-3">
          <Alert variant={state.report.errorRows > 0 ? "danger" : "success"}>
            {state.report.totalRows} linha(s) processada(s) —{" "}
            {state.report.successRows} com sucesso, {state.report.errorRows}{" "}
            com erro.
          </Alert>

          {state.report.errorRows > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadErrorsCsv(state)}
              className="self-start"
            >
              Baixar CSV das linhas com erro
            </Button>
          ) : null}

          <div className="max-h-96 overflow-auto rounded-[var(--radius-sm)] border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {state.report.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.fullName ?? "—"}</td>
                    <td className="px-3 py-2">{row.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.status === "success" ? (
                        <span className="text-success">sucesso</span>
                      ) : (
                        <span className="text-danger">erro</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {row.errors.join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
