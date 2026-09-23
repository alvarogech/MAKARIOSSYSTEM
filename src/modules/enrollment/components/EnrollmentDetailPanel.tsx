"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatSaoPauloDateTime } from "@/lib/saoPauloDate";
import { buildWhatsAppLink } from "@/services/whatsapp";
import { scheduleLabel, volumeLabel } from "../labels";
import { reviewEnrollmentRequest, type ReviewEnrollmentRequestState } from "../actions/reviewEnrollmentRequest";
import { ENROLLMENT_STATUS_LABELS, type EnrollmentRequestRow } from "../types";
import { EnrollmentStatusBadge } from "./EnrollmentStatusBadge";

const initialState: ReviewEnrollmentRequestState = {};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sem permissão de clipboard no navegador: falha silenciosa, o
      // administrador ainda vê o valor no texto ao lado do botão.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export function EnrollmentDetailPanel({
  row,
  closeHref,
}: {
  row: EnrollmentRequestRow;
  closeHref: string;
}) {
  const [state, formAction, isPending] = useActionState(reviewEnrollmentRequest, initialState);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <Link
        href={closeHref}
        aria-label="Fechar detalhes da inscrição"
        className="absolute inset-0 bg-neutral-900/40"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da inscrição de ${row.fullName}`}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-neutral-200 bg-white p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {row.protocol}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-900">{row.fullName}</h2>
            <div className="mt-2">
              <EnrollmentStatusBadge status={row.status} />
            </div>
          </div>
          <Link
            href={closeHref}
            aria-label="Fechar"
            className="rounded-[var(--radius-sm)] p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>

        {state.error ? (
          <div className="mt-4">
            <Alert variant="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.warning ? (
          <div className="mt-4">
            <Alert variant="warning">{state.warning}</Alert>
          </div>
        ) : null}
        {state.success && !state.warning && !state.error ? (
          <div className="mt-4">
            <Alert variant="success">Status atualizado.</Alert>
          </div>
        ) : null}

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Contato</h3>
          <div className="mt-2 flex flex-col gap-2 text-sm text-neutral-700">
            <div className="flex items-center justify-between gap-2">
              <span>{row.email}</span>
              <CopyButton value={row.email} label="e-mail" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{row.phone}</span>
              <div className="flex items-center gap-2">
                <CopyButton value={row.phone} label="telefone" />
                <a
                  href={buildWhatsAppLink(row.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  WhatsApp
                </a>
              </div>
            </div>
            <p className="text-xs text-neutral-400">CPF terminado em {row.cpfLast4}</p>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Volume e turma
          </h3>
          <div className="mt-2 text-sm text-neutral-700">
            <p>
              <strong className="font-medium text-neutral-900">Principal:</strong>{" "}
              {volumeLabel(row.primaryVolumeSlug)} · {scheduleLabel(row.primaryScheduleSlug)}
            </p>
            {row.wantsSecondVolume ? (
              <p className="mt-1">
                <strong className="font-medium text-neutral-900">Segundo volume:</strong>{" "}
                {volumeLabel(row.secondaryVolumeSlug)} · {scheduleLabel(row.secondaryScheduleSlug)}
              </p>
            ) : null}
          </div>
        </section>

        {row.prerequisiteDeclaration ? (
          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Declaração de pré-requisito
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {row.prerequisiteDeclaration}
            </p>
          </section>
        ) : null}

        {row.notes ? (
          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Observações
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{row.notes}</p>
          </section>
        ) : null}

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Inscrição</h3>
          <p className="mt-2 text-sm text-neutral-700">{formatSaoPauloDateTime(row.createdAt)}</p>
          {row.reviewedAt ? (
            <p className="mt-1 text-xs text-neutral-400">
              Revisada em {formatSaoPauloDateTime(row.reviewedAt)}
            </p>
          ) : null}
        </section>

        <section className="mt-8 border-t border-neutral-100 pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Alterar status
          </h3>
          <form action={formAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="requestId" value={row.id} />
            {row.status !== "approved" ? (
              <Button type="submit" name="status" value="approved" size="sm" isLoading={isPending}>
                Aprovar
              </Button>
            ) : null}
            {row.status !== "rejected" ? (
              <Button
                type="submit"
                name="status"
                value="rejected"
                variant="danger"
                size="sm"
                isLoading={isPending}
              >
                Recusar
              </Button>
            ) : null}
            {row.status !== "cancelled" ? (
              <Button
                type="submit"
                name="status"
                value="cancelled"
                variant="secondary"
                size="sm"
                isLoading={isPending}
              >
                Cancelar
              </Button>
            ) : null}
            {row.status !== "pending" ? (
              <Button
                type="submit"
                name="status"
                value="pending"
                variant="ghost"
                size="sm"
                isLoading={isPending}
              >
                Voltar para pendente
              </Button>
            ) : null}
          </form>
          <p className="mt-2 text-xs leading-5 text-neutral-400">
            Aprovar envia o convite de acesso (perfil Aluno) por e-mail. A matrícula em si
            continua sendo feita depois, em Matrículas, após a pessoa aceitar o convite.
          </p>
          <p className="mt-3 text-xs text-neutral-400">
            Status atual:{" "}
            <span className="font-medium text-neutral-600">
              {ENROLLMENT_STATUS_LABELS[row.status]}
            </span>
          </p>
        </section>
      </aside>
    </div>
  );
}
