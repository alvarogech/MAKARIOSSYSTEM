"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { formatSaoPauloDateTime } from "@/lib/saoPauloDate";
import { scheduleLabel, volumeLabel } from "../labels";
import type { EnrollmentRequestRow } from "../types";
import { EnrollmentStatusBadge } from "./EnrollmentStatusBadge";

const RECENT_HIGHLIGHT_MS = 60_000;

export function EnrollmentTable({
  rows,
  baseQueryForDetail,
  nowIso,
}: {
  rows: EnrollmentRequestRow[];
  /**
   * Query string atual (sem `detail`) — Server Components não podem passar
   * funções para Client Components, então em vez de receber uma função
   * `buildDetailHref`, este componente monta o link de cada linha juntando
   * esta string com `detail=<id>`.
   */
  baseQueryForDetail: string;
  nowIso: string;
}) {
  const router = useRouter();
  const now = new Date(nowIso).getTime();

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500 shadow-sm">
        Nenhuma inscrição encontrada com os filtros atuais.
      </div>
    );
  }

  function detailHrefFor(id: string): string {
    const params = new URLSearchParams(baseQueryForDetail);
    params.set("detail", id);
    return `/coordenacao/inscricoes?${params.toString()}`;
  }

  function goToDetail(href: string) {
    router.push(href);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, href: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToDetail(href);
    }
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Contato</th>
            <th className="px-4 py-3">Volume / turma</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Inscrição</th>
            <th className="px-4 py-3">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => {
            const isRecent = now - new Date(row.createdAt).getTime() < RECENT_HIGHLIGHT_MS;
            const href = detailHrefFor(row.id);
            return (
              <tr
                key={row.id}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes da inscrição de ${row.fullName}`}
                onClick={() => goToDetail(href)}
                onKeyDown={(event) => handleRowKeyDown(event, href)}
                className={`cursor-pointer transition-colors hover:bg-brand-blue-light focus-visible:bg-brand-blue-light focus-visible:outline-none ${
                  isRecent ? "bg-brand-blue-light/70" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-neutral-900">
                  {row.fullName}
                  {isRecent ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Nova
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  <div>{row.email}</div>
                  <div className="text-xs text-neutral-400">{row.phone}</div>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {volumeLabel(row.primaryVolumeSlug)} · {scheduleLabel(row.primaryScheduleSlug)}
                  {row.wantsSecondVolume && row.secondaryVolumeSlug ? (
                    <div className="text-xs text-neutral-400">
                      + {volumeLabel(row.secondaryVolumeSlug)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <EnrollmentStatusBadge status={row.status} />
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
  );
}
