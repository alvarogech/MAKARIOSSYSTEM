"use client";

import { useActionState } from "react";
import { publishCeremony, saveCeremony, setEditionStatus } from "../actions/editions";
import { inviteApt } from "../actions/participants";
import { EDITION_STATUS_LABELS, type EditionStatus } from "../ceremony";
import type { GraduationState } from "../guard";
import { FormFeedback } from "./badges";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const TEXTAREA =
  "w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

export interface CeremonyValues {
  editionId: string;
  updatedAt: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  locationName: string;
  address: string;
  instructions: string;
  rsvpDeadline: string;
  inviteMessage: string;
}

export function CeremonyForm({ values, disabled }: { values: CeremonyValues; disabled: boolean }) {
  const [state, action, pending] = useActionState(saveCeremony, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="editionId" value={values.editionId} />
      <input type="hidden" name="updatedAt" value={values.updatedAt} />
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="eventName">Nome do evento</Label>
          <Input id="eventName" name="eventName" maxLength={160} defaultValue={values.eventName} placeholder="Formatura Makários 2026-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="eventDate">Data</Label>
            <Input id="eventDate" name="eventDate" type="date" defaultValue={values.eventDate} />
          </div>
          <div>
            <Label htmlFor="eventTime">Horário</Label>
            <Input id="eventTime" name="eventTime" type="time" defaultValue={values.eventTime} />
          </div>
          <div>
            <Label htmlFor="rsvpDeadline">Prazo para confirmação</Label>
            <Input id="rsvpDeadline" name="rsvpDeadline" type="datetime-local" defaultValue={values.rsvpDeadline} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="locationName">Local</Label>
            <Input id="locationName" name="locationName" maxLength={160} defaultValue={values.locationName} />
          </div>
          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" name="address" maxLength={300} defaultValue={values.address} />
          </div>
        </div>
        <div>
          <Label htmlFor="instructions">Orientações aos formandos</Label>
          <textarea id="instructions" name="instructions" rows={3} maxLength={2000} defaultValue={values.instructions} className={TEXTAREA} placeholder="Traje, chegada, quantos convidados, etc." />
        </div>
        <div>
          <Label htmlFor="inviteMessage">Mensagem de convite (aparece para o aluno)</Label>
          <textarea id="inviteMessage" name="inviteMessage" rows={3} maxLength={1000} defaultValue={values.inviteMessage} className={TEXTAREA} placeholder="Se deixar em branco, o aluno vê a mensagem padrão de parabéns." />
        </div>
      </fieldset>
      <FormFeedback state={state} />
      {!disabled ? (
        <div>
          <Button type="submit" isLoading={pending}>
            Salvar dados da cerimônia
          </Button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Esta edição está encerrada: os dados não podem mais ser alterados.</p>
      )}
    </form>
  );
}

export function PublishForm({ editionId, published }: { editionId: string; published: boolean }) {
  const [state, action, pending] = useActionState(publishCeremony, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <FormFeedback state={state} />
      <div>
        <Button type="submit" variant={published ? "secondary" : "primary"} isLoading={pending}>
          {published ? "Reabrir confirmações" : "Publicar cerimônia e abrir confirmações"}
        </Button>
      </div>
      <p className="text-xs text-neutral-500">
        Antes de publicar o sistema confere se data, horário, local, endereço e prazo estão preenchidos. Só depois disso os alunos convidados veem a cerimônia e podem responder.
      </p>
    </form>
  );
}

export function StatusForm({ editionId, options }: { editionId: string; options: EditionStatus[] }) {
  const [state, action, pending] = useActionState(setEditionStatus, {} as GraduationState);
  if (options.length === 0) return null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <div className="flex flex-wrap gap-2">
        {options.map((status) => (
          <Button key={status} type="submit" name="status" value={status} size="sm" variant="secondary" isLoading={pending}>
            Mudar para: {EDITION_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
      <FormFeedback state={state} />
    </form>
  );
}

export function InviteAllForm({ editionId, aptoPending }: { editionId: string; aptoPending: number }) {
  const [state, action, pending] = useActionState(inviteApt, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="todosAptos" value="1" />
      <div>
        <Button type="submit" isLoading={pending} disabled={aptoPending === 0}>
          Convidar os {aptoPending} apto(s) ainda sem convite
        </Button>
      </div>
      <FormFeedback state={state} />
      <p className="text-xs text-neutral-500">A aptidão é conferida de novo no momento do convite. Alunos com pendência não são convidados.</p>
    </form>
  );
}
