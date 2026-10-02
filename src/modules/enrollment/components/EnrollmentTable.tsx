"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatSaoPauloDateTime } from "@/lib/saoPauloDate";
import { formatBrazilianPhone } from "@/services/phone";
import { checkEnrollmentDataQuality } from "../dataQuality";
import { scheduleLabel, volumeLabel } from "../labels";
import { EnrollmentBulkActionsBar } from "./EnrollmentBulkActionsBar";
import { EnrollmentStatusBadge } from "./EnrollmentStatusBadge";
import type { EnrollmentRequestRow, EnrollmentSortDir, EnrollmentSortField } from "../types";

const SORT_COLUMNS: { field: EnrollmentSortField; label: string }[] = [
  { field: "fullName", label: "Nome" },
  { field: "primaryVolumeSlug", label: "Curso" },
  { field: "primaryScheduleSlug", label: "Turma" },
  { field: "status", label: "Status" },
  { field: "createdAt", label: "Inscrição" },
];

function DataQualityFlag({ row }: { row: EnrollmentRequestRow }) {
  const flags = checkEnrollmentDataQuality({ email: row.email, phone: row.phone });
  if (flags.length === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-warning"
      title={flags.map((flag) => flag.suggestion ?? flag.message).join(" ")}
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Possível inconsistência nos dados</span>
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: EnrollmentSortDir }) {
  if (!active) return <ArrowUpDown className="size-3 text-neutral-300" aria-hidden="true" />;
  return dir === "asc" ? (
    <ArrowUp className="size-3 text-brand-blue" aria-hidden="true" />
  ) : (
    <ArrowDown className="size-3 text-brand-blue" aria-hidden="true" />
  );
}

export function EnrollmentTable({
  rows,
  baseQueryForDetail,
  baseQueryForSort,
  nowIso,
  sort,
  dir,
  totalFilteredCount,
  selectionIdsHref,
}: {
  rows: EnrollmentRequestRow[];
  /**
   * Query string atual (sem `detail`) — Server Components não podem passar
   * funções para Client Components, então em vez de receber uma função
   * `buildDetailHref`, este componente monta o link de cada linha juntando
   * esta string com `detail=<id>`.
   */
  baseQueryForDetail: string;
  /** Mesma ideia, mas sem `sort`/`dir`/`page` — usada para montar os links de ordenação das colunas. */
  baseQueryForSort: string;
  nowIso: string;
  sort: EnrollmentSortField;
  dir: EnrollmentSortDir;
  totalFilteredCount: number;
  /** URL da rota que devolve todos os ids que atendem ao filtro atual (sem paginar). */
  selectionIdsHref: string;
}) {
  const router = useRouter();
  const now = new Date(nowIso).getTime();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionLoading, setSelectionLoading] = useState(false);

  function detailHrefFor(id: string): string {
    const params = new URLSearchParams(baseQueryForDetail);
    params.set("detail", id);
    return `/coordenacao/inscricoes?${params.toString()}`;
  }

  function sortHrefFor(field: EnrollmentSortField): string {
    const nextDir: EnrollmentSortDir =
      sort === field ? (dir === "asc" ? "desc" : "asc") : field === "createdAt" ? "desc" : "asc";
    const params = new URLSearchParams(baseQueryForSort);
    if (field === "createdAt") params.delete("sort");
    else params.set("sort", field);
    if (nextDir === "desc") params.delete("dir");
    else params.set("dir", nextDir);
    return `/coordenacao/inscricoes?${params.toString()}`;
  }

  function goToDetail(href: string) {
    router.push(href);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>, href: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToDetail(href);
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function selectAllFiltered() {
    setSelectionLoading(true);
    try {
      const response = await fetch(selectionIdsHref);
      if (!response.ok) return;
      const data: { ids: string[] } = await response.json();
      setSelected(new Set(data.ids));
    } finally {
      setSelectionLoading(false);
    }
  }

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500 shadow-sm">
        Nenhuma inscrição corresponde aos filtros selecionados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <EnrollmentBulkActionsBar
        selectedIds={Array.from(selected)}
        onClearSelection={() => setSelected(new Set())}
        onSelectAllFiltered={selectAllFiltered}
        totalFilteredCount={totalFilteredCount}
        selectionLoading={selectionLoading}
      />

      {/* Desktop/tablet: tabela completa. */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as inscrições desta página"
                  checked={allOnPageSelected}
                  onChange={(event) => toggleAllOnPage(event.target.checked)}
                  className="size-4 rounded border-neutral-300 accent-brand-blue"
                />
              </th>
              <th className="px-4 py-3">Contato</th>
              {SORT_COLUMNS.map((column) => (
                <th key={column.field} className="px-4 py-3">
                  <Link
                    href={sortHrefFor(column.field)}
                    className="inline-flex items-center gap-1 hover:text-neutral-800"
                    aria-label={`Ordenar por ${column.label}`}
                  >
                    {column.label}
                    <SortIcon active={sort === column.field} dir={dir} />
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const isNew = !row.viewedAt;
              const href = detailHrefFor(row.id);
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes da inscrição de ${row.fullName}`}
                  onClick={() => goToDetail(href)}
                  onKeyDown={(event) => handleRowKeyDown(event, href)}
                  className={`cursor-pointer transition-colors hover:bg-brand-blue-light focus-visible:bg-brand-blue-light focus-visible:outline-none ${
                    isNew ? "bg-brand-blue-light/70" : isSelected ? "bg-neutral-50" : ""
                  }`}
                >
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar inscrição de ${row.fullName}`}
                      checked={isSelected}
                      onChange={(event) => toggleOne(row.id, event.target.checked)}
                      className="size-4 rounded border-neutral-300 accent-brand-blue"
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    <div className="flex items-center gap-2 font-medium text-neutral-900">
                      {row.fullName}
                      {isNew ? (
                        <span className="inline-flex items-center rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Nova
                        </span>
                      ) : null}
                      <DataQualityFlag row={row} />
                    </div>
                    <div>{row.email}</div>
                    <div className="text-xs text-neutral-400">{formatBrazilianPhone(row.phone)}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {volumeLabel(row.primaryVolumeSlug)}
                    {row.wantsSecondVolume && row.secondaryVolumeSlug ? (
                      <span className="text-xs text-neutral-400"> + {volumeLabel(row.secondaryVolumeSlug)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{scheduleLabel(row.primaryScheduleSlug)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <EnrollmentStatusBadge status={row.status} />
                      {row.studentId ? (
                        <span
                          className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success"
                          title="Já aceitou o convite e tem matrícula — clique para ver/mudar a turma"
                        >
                          Matriculado(a)
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatSaoPauloDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={href}
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium text-brand-blue hover:text-brand-blue-dark hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: lista de cards — nunca a tabela larga, para nunca causar rolagem horizontal da página. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => {
          const isNew = !row.viewedAt;
          const href = detailHrefFor(row.id);
          const isSelected = selected.has(row.id);
          return (
            <li
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da inscrição de ${row.fullName}`}
              onClick={() => goToDetail(href)}
              onKeyDown={(event) => handleRowKeyDown(event, href)}
              className={`flex cursor-pointer flex-col gap-2 rounded-[var(--radius-md)] border p-3 shadow-sm focus-visible:outline-none ${
                isNew ? "border-brand-blue/40 bg-brand-blue-light/60" : "border-neutral-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex min-w-0 flex-1 items-start gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`Selecionar inscrição de ${row.fullName}`}
                    checked={isSelected}
                    onChange={(event) => toggleOne(row.id, event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-neutral-300 accent-brand-blue"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{row.fullName}</p>
                    {isNew ? (
                      <span className="mt-0.5 inline-flex items-center rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Nova
                      </span>
                    ) : null}
                    <DataQualityFlag row={row} />
                    <p className="truncate text-xs text-neutral-500">{formatBrazilianPhone(row.phone)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <EnrollmentStatusBadge status={row.status} />
                  {row.studentId ? (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                      Matriculado(a)
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="text-sm text-neutral-600">
                {volumeLabel(row.primaryVolumeSlug)} · {scheduleLabel(row.primaryScheduleSlug)}
              </p>
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{formatSaoPauloDateTime(row.createdAt)}</span>
                <Link
                  href={href}
                  onClick={(event) => event.stopPropagation()}
                  className="font-medium text-brand-blue hover:underline"
                >
                  Ver detalhes
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
