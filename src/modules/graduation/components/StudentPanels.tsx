"use client";

import { useActionState, useState } from "react";
import { MessageCircle } from "lucide-react";
import { confirmCertificateName, recordRsvp } from "../actions/participants";
import { recordContact, saveFollowUp } from "../actions/followUp";
import { revokeHistory, validateHistory } from "../actions/history";
import { CONTACT_LABELS, CONTACT_STATUSES, type ContactStatus } from "../boardView";
import { buildContactLink } from "../contactMessage";
import type { GraduationState } from "../guard";
import { MODULE_LABELS, MODULES } from "../types";
import { FormFeedback } from "./badges";
import { Button, buttonVariants } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const SELECT =
  "h-10 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";
const TEXTAREA =
  "w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "presencial", label: "Presencialmente" },
  { value: "email", label: "E-mail" },
  { value: "outro", label: "Outro" },
];

/**
 * Contato com o aluno. O sistema só PREPARA a mensagem: abre o WhatsApp para envio
 * manual e permite copiar. O contato só entra no histórico quando a coordenação
 * confirma, no formulário abaixo, que realmente enviou.
 */
export function ContactPanel({
  editionId,
  studentId,
  phone,
  initialMessage,
}: {
  editionId: string;
  studentId: string;
  phone: string | null;
  initialMessage: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [state, action, pending] = useActionState(recordContact, {} as GraduationState);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="contact-message">Mensagem sugerida (pode editar antes de enviar)</Label>
        <textarea id="contact-message" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className={TEXTAREA} />
      </div>
      <div className="flex flex-wrap gap-2">
        {phone ? (
          <a href={buildContactLink(phone, message)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm" })}>
            <MessageCircle className="size-4" aria-hidden="true" />
            Entrar em contato pelo WhatsApp
          </a>
        ) : (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs text-amber-800">Aluno sem telefone cadastrado</span>
        )}
        <CopyButton value={message} label="mensagem" />
      </div>
      <p className="text-xs text-neutral-500">
        Abrir o WhatsApp não registra nada: a conversa só começa quando você enviar. Depois de enviar, registre o contato abaixo.
      </p>

      <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
        <input type="hidden" name="editionId" value={editionId} />
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="messageText" value={message} />
        <p className="text-sm font-medium text-neutral-800">Registrar contato realizado</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rc-channel">Canal</Label>
            <select id="rc-channel" name="channel" defaultValue="whatsapp" className={SELECT}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="rc-status">Situação depois do contato</Label>
            <select id="rc-status" name="contactStatus" defaultValue="aguardando_aluno" className={SELECT}>
              {CONTACT_STATUSES.filter((s) => s !== "nao_contatado").map((s) => (
                <option key={s} value={s}>
                  {CONTACT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="rc-summary">O que foi tratado</Label>
          <textarea id="rc-summary" name="summary" rows={2} maxLength={1000} className={TEXTAREA} />
        </div>
        <div>
          <Label htmlFor="rc-response">Resposta do aluno (se já respondeu)</Label>
          <textarea id="rc-response" name="response" rows={2} maxLength={1000} className={TEXTAREA} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rc-next">Próxima providência</Label>
            <Input id="rc-next" name="nextStep" maxLength={500} />
          </div>
          <div>
            <Label htmlFor="rc-due">Prazo</Label>
            <Input id="rc-due" name="dueDate" type="date" />
          </div>
        </div>
        <FormFeedback state={state} />
        <div>
          <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
            Confirmo que enviei: registrar contato
          </Button>
        </div>
      </form>
    </div>
  );
}

export function FollowUpForm({
  editionId,
  studentId,
  requirements,
  responsibles,
  current,
}: {
  editionId: string;
  studentId: string;
  requirements: { key: string; title: string }[];
  responsibles: { id: string; name: string }[];
  current: { contactStatus: ContactStatus; responsibleId: string | null; nextStep: string | null; dueDate: string | null; notes: string | null } | null;
}) {
  const [state, action, pending] = useActionState(saveFollowUp, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="fu-req">Acompanhar</Label>
          <select id="fu-req" name="requirementKey" defaultValue="geral" className={SELECT}>
            <option value="geral">O aluno como um todo</option>
            {requirements.map((r) => (
              <option key={r.key} value={r.key}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fu-status">Situação do contato</Label>
          <select id="fu-status" name="contactStatus" defaultValue={current?.contactStatus ?? "nao_contatado"} className={SELECT}>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTACT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fu-resp">Responsável</Label>
          <select id="fu-resp" name="responsibleId" defaultValue={current?.responsibleId ?? ""} className={SELECT}>
            <option value="">Sem responsável</option>
            {responsibles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fu-next">Próxima providência</Label>
          <Input id="fu-next" name="nextStep" maxLength={500} defaultValue={current?.nextStep ?? ""} />
        </div>
        <div>
          <Label htmlFor="fu-due">Prazo</Label>
          <Input id="fu-due" name="dueDate" type="date" defaultValue={current?.dueDate ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="fu-notes">Observações</Label>
        <textarea id="fu-notes" name="notes" rows={2} maxLength={2000} defaultValue={current?.notes ?? ""} className={TEXTAREA} />
      </div>
      <p className="text-xs text-neutral-500">
        Isto é o acompanhamento operacional. Marcar &ldquo;Regularização concluída&rdquo; não torna o aluno apto: a situação acadêmica só muda quando os registros mudam.
      </p>
      <FormFeedback state={state} />
      <div>
        <Button type="submit" size="sm" isLoading={pending}>
          Salvar acompanhamento
        </Button>
      </div>
    </form>
  );
}

export function ValidateHistoryForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(validateHistory, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
      <input type="hidden" name="studentId" value={studentId} />
      <p className="text-sm font-medium text-neutral-800">Reconhecer uma conclusão anterior</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="vh-volume">Módulo</Label>
          <select id="vh-volume" name="volume" required defaultValue="" className={SELECT}>
            <option value="" disabled>
              Escolha…
            </option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {MODULE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="vh-season">Temporada (se souber)</Label>
          <Input id="vh-season" name="seasonLabel" maxLength={60} placeholder="Ex.: 2025.1" />
        </div>
      </div>
      <div>
        <Label htmlFor="vh-origin">Origem da informação</Label>
        <Input id="vh-origin" name="origin" required minLength={3} maxLength={300} placeholder="Ex.: lista de presença impressa de 2025" />
      </div>
      <div>
        <Label htmlFor="vh-evidence">Evidência</Label>
        <textarea id="vh-evidence" name="evidence" required minLength={5} maxLength={2000} rows={3} className={TEXTAREA} placeholder="O que comprova a conclusão (documento, página, quem confirmou)." />
      </div>
      <FormFeedback state={state} />
      <div>
        <Button type="submit" size="sm" isLoading={pending}>
          Validar histórico
        </Button>
      </div>
    </form>
  );
}

export function RevokeHistoryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeHistory, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Label htmlFor={`rv-${id}`}>Motivo da revogação</Label>
          <Input id={`rv-${id}`} name="reason" required minLength={5} maxLength={500} />
        </div>
        <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
          Revogar
        </Button>
      </div>
      <FormFeedback state={state} />
    </form>
  );
}

export function RsvpForm({ editionId, studentId }: { editionId: string; studentId: string }) {
  const [state, action, pending] = useActionState(recordRsvp, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="studentId" value={studentId} />
      <p className="text-sm font-medium text-neutral-800">Registrar resposta recebida pela coordenação</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rsvp-response">Resposta do aluno</Label>
          <select id="rsvp-response" name="response" required defaultValue="" className={SELECT}>
            <option value="" disabled>
              Escolha…
            </option>
            <option value="confirmado">Confirmou presença</option>
            <option value="nao_comparece">Não comparecerá</option>
          </select>
        </div>
        <div>
          <Label htmlFor="rsvp-channel">Canal</Label>
          <select id="rsvp-channel" name="channel" required defaultValue="whatsapp" className={SELECT}>
            <option value="whatsapp">WhatsApp</option>
            <option value="presencial">Presencialmente</option>
            <option value="telefone">Telefone</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>
      <FormFeedback state={state} />
      <div>
        <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
          Registrar resposta
        </Button>
      </div>
    </form>
  );
}

export function CertificateNameForm({ editionId, studentId, suggested, checked }: { editionId: string; studentId: string; suggested: string; checked: boolean }) {
  const [state, action, pending] = useActionState(confirmCertificateName, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="studentId" value={studentId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1">
          <Label htmlFor={`cn-${studentId}`}>Nome que será impresso no certificado</Label>
          <Input id={`cn-${studentId}`} name="certificateName" required maxLength={160} defaultValue={suggested} />
        </div>
        <Button type="submit" size="sm" variant={checked ? "secondary" : "primary"} isLoading={pending}>
          {checked ? "Atualizar nome conferido" : "Conferir nome"}
        </Button>
      </div>
      <FormFeedback state={state} />
    </form>
  );
}
