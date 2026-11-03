"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Download, Mail } from "lucide-react";
import { inviteApt } from "../actions/participants";
import type { GraduationState } from "../guard";
import { MODULE_STATUS_LABELS } from "../eligibility";
import type { CandidateVM } from "../viewModel";
import { BulkHistoryForm } from "./BulkHistoryForm";
import { FormFeedback, ModuleDot, OverallBadge } from "./badges";
import { Button, buttonVariants } from "@/components/ui/Button";

const MODULE_STUB = (m: CandidateVM["modules"][number]) => ({
  slug: m.slug as "essencia" | "caminho" | "voz",
  label: m.label,
  status: m.status,
  origin: "sem_evidencia" as const,
  seasonName: m.seasonName,
  className: null,
  completedOn: null,
  attendance: null,
  grade: null,
  passingGrade: null,
  note: "",
});

const RESPONSE_LABEL: Record<string, string> = { sem_resposta: "Aguardando resposta", confirmado: "Confirmou presença", nao_comparece: "Não comparecerá" };

/** Tabela de candidatos com seleção múltipla para ações seguras (exportar e convidar aptos). */
export function CandidatesTable({
  rows,
  editionId,
  canInvite,
  canExport,
  canValidateHistory = false,
}: {
  rows: CandidateVM[];
  editionId: string;
  canInvite: boolean;
  canExport: boolean;
  canValidateHistory?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(inviteApt, {} as GraduationState);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.studentId));
  const ids = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return <p className="rounded-[var(--radius-lg)] border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">Nenhum candidato com esses filtros.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 ? (
        <form action={action} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-brand-blue/30 bg-brand-blue-light px-3 py-2 text-sm">
          <input type="hidden" name="editionId" value={editionId} />
          {ids.map((id) => (
            <input key={id} type="hidden" name="studentIds" value={id} />
          ))}
          <span className="font-medium text-brand-blue-dark">{selected.size} selecionado(s)</span>
          {canExport ? (
            <a
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              href={`/coordenacao/formatura/exportar?edicao=${editionId}&lista=selecionados&formato=csv&ids=${ids.join(",")}`}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Exportar seleção (CSV)
            </a>
          ) : null}
          {canInvite ? (
            <Button type="submit" size="sm" isLoading={pending}>
              <Mail className="size-3.5" aria-hidden="true" />
              Convidar os aptos da seleção
            </Button>
          ) : null}
          <button type="button" className="text-xs text-brand-blue underline" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </button>
        </form>
      ) : null}
      <FormFeedback state={state} />
      {selected.size > 0 && canValidateHistory ? <BulkHistoryForm ids={ids} /> : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-neutral-200 bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os candidatos listados"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.studentId)))}
                  className="size-4 accent-brand-blue"
                />
              </th>
              <th className="px-3 py-2">Aluno</th>
              <th className="px-3 py-2">Turma de Voz</th>
              <th className="px-3 py-2">Jornada</th>
              <th className="px-3 py-2">Voz</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2">Pend.</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.studentId} className="align-top hover:bg-neutral-50">
                <td className="px-3 py-3">
                  <input type="checkbox" aria-label={`Selecionar ${row.name}`} checked={selected.has(row.studentId)} onChange={() => toggle(row.studentId)} className="size-4 accent-brand-blue" />
                </td>
                <td className="px-3 py-3">
                  <Link href={`/coordenacao/formatura/${row.studentId}?edicao=${editionId}`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                    {row.name}
                  </Link>
                  <p className="text-xs text-neutral-500">{row.phone ?? "sem telefone"}</p>
                  {row.email ? <p className="max-w-52 truncate text-xs text-neutral-500" title={row.email}>{row.email}</p> : null}
                </td>
                <td className="px-3 py-3 text-neutral-700">
                  {row.className ?? <span className="text-neutral-400">—</span>}
                  {row.seasonName ? <p className="text-xs text-neutral-500">{row.seasonName}</p> : null}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {row.modules.map((m) => (
                      <ModuleDot key={m.slug} module={MODULE_STUB(m)} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-neutral-700">
                  <p title="Frequência em Voz (mínimo 75%)">{row.attendancePct === null ? "—" : `${String(row.attendancePct).replace(".", ",")}%`} freq.</p>
                  <p title="Melhor nota em Voz">{row.grade === null ? "sem nota" : `nota ${row.grade.toFixed(1).replace(".", ",")}`}</p>
                </td>
                <td className="px-3 py-3">
                  <OverallBadge status={row.overall} />
                  {row.invited ? <p className="mt-1 text-xs text-neutral-500">{RESPONSE_LABEL[row.response] ?? row.response}</p> : null}
                </td>
                <td className="px-3 py-3">
                  <span
                    title={row.categories.length ? row.categories.join(" · ") : "Sem pendências"}
                    className={`inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.openCount === 0 ? "bg-neutral-100 text-neutral-500" : "bg-amber-50 text-amber-700"}`}
                  >
                    {row.openCount}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-neutral-700">
                  <p className={row.overdue ? "font-medium text-danger" : ""}>{row.contactLabel}{row.overdue ? " · prazo vencido" : ""}</p>
                  {row.responsibleName ? <p className="text-neutral-500">{row.responsibleName}</p> : null}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/coordenacao/formatura/${row.studentId}?edicao=${editionId}`} className="text-sm font-medium text-brand-blue hover:underline">
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Jornada: {Object.values(MODULE_STATUS_LABELS).join(" · ")}. Passe o mouse (ou toque) nos ícones para ver o módulo e a temporada.
      </p>
    </div>
  );
}
