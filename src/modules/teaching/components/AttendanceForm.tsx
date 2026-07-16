"use client";

import { useActionState, useState } from "react";
import { saveAttendance, type SaveAttendanceState } from "../actions/saveAttendance";
import {
  finalizeAttendance,
  type FinalizeAttendanceState,
} from "../actions/finalizeAttendance";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { AttendanceStatus } from "@/integrations/supabase/types";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  presente: "Presente",
  ausente: "Ausente",
  atrasado: "Atrasado",
  presenca_parcial: "Presença parcial",
  falta_justificada: "Falta justificada",
  reposicao: "Reposição",
  pendente: "Pendente",
};

const STATUSES = Object.keys(STATUS_LABELS) as AttendanceStatus[];

export interface RosterEntry {
  enrollmentId: string;
  studentName: string;
  status: AttendanceStatus;
  recognizedMinutes: number;
  observation: string;
}

const initialSaveState: SaveAttendanceState = {};
const initialFinalizeState: FinalizeAttendanceState = {};

export function AttendanceForm({
  meetingId,
  academicMinutes,
  initialRoster,
  isFinalized,
}: {
  meetingId: string;
  academicMinutes: number;
  initialRoster: RosterEntry[];
  isFinalized: boolean;
}) {
  const [roster, setRoster] = useState(initialRoster);
  const [saveState, saveFormAction, isSaving] = useActionState(saveAttendance, initialSaveState);
  const [finalizeState, finalizeFormAction, isFinalizing] = useActionState(
    finalizeAttendance,
    initialFinalizeState,
  );

  function updateRow(enrollmentId: string, patch: Partial<RosterEntry>) {
    setRoster((prev) =>
      prev.map((row) => (row.enrollmentId === enrollmentId ? { ...row, ...patch } : row)),
    );
  }

  function markAllPresent() {
    setRoster((prev) =>
      prev.map((row) => ({ ...row, status: "presente", recognizedMinutes: academicMinutes })),
    );
  }

  const rowsJson = JSON.stringify(
    roster.map((row) => ({
      enrollmentId: row.enrollmentId,
      status: row.status,
      recognizedMinutes: row.recognizedMinutes,
      observation: row.observation || undefined,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      {saveState.error ? <Alert variant="danger">{saveState.error}</Alert> : null}
      {saveState.success ? <Alert variant="success">Frequência salva.</Alert> : null}
      {finalizeState.success ? (
        <Alert variant="success">
          Frequência finalizada — só coordenação/administração podem corrigir agora.
        </Alert>
      ) : null}
      {finalizeState.error ? <Alert variant="danger">{finalizeState.error}</Alert> : null}

      {isFinalized ? (
        <Alert variant="info">
          Esta frequência já foi finalizada. Só coordenação/administração
          podem corrigir a partir daqui.
        </Alert>
      ) : (
        <Button type="button" variant="secondary" onClick={markAllPresent} className="self-start">
          Marcar todos presentes
        </Button>
      )}

      <form action={saveFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="meetingId" value={meetingId} />
        <input type="hidden" name="rows" value={rowsJson} />

        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Aluno</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Minutos reconhecidos</th>
                <th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {roster.map((row) => (
                <tr key={row.enrollmentId}>
                  <td className="px-3 py-2 text-neutral-700">{row.studentName}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.status}
                      disabled={isFinalized}
                      onChange={(e) => {
                        const status = e.target.value as AttendanceStatus;
                        const autoMinutes =
                          status === "presente"
                            ? academicMinutes
                            : status === "atrasado" || status === "presenca_parcial"
                              ? row.recognizedMinutes
                              : 0;
                        updateRow(row.enrollmentId, { status, recognizedMinutes: autoMinutes });
                      }}
                      className="h-9 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2 text-sm disabled:bg-neutral-100"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={academicMinutes}
                      value={row.recognizedMinutes}
                      disabled={isFinalized || (row.status !== "atrasado" && row.status !== "presenca_parcial" && row.status !== "presente")}
                      onChange={(e) =>
                        updateRow(row.enrollmentId, { recognizedMinutes: Number(e.target.value) })
                      }
                      className="h-9 w-24 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2 text-sm disabled:bg-neutral-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.observation}
                      disabled={isFinalized}
                      onChange={(e) => updateRow(row.enrollmentId, { observation: e.target.value })}
                      className="h-9 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-2 text-sm disabled:bg-neutral-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isFinalized ? (
          <Button type="submit" isLoading={isSaving} className="self-start">
            Salvar frequência
          </Button>
        ) : null}
      </form>

      {!isFinalized ? (
        <form action={finalizeFormAction}>
          <input type="hidden" name="meetingId" value={meetingId} />
          <Button type="submit" variant="ghost" isLoading={isFinalizing}>
            Finalizar frequência
          </Button>
        </form>
      ) : null}
    </div>
  );
}
