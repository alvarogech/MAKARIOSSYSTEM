"use client";

import { useActionState } from "react";
import {
  createTeacherInvitation,
  type CreateTeacherInvitationState,
} from "../actions/createTeacherInvitation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { CopyButton } from "@/components/ui/CopyButton";

const initialState: CreateTeacherInvitationState = {};

export function CreateTeacherInvitationForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createTeacherInvitation,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp (com DDD)</Label>
            <Input id="phone" name="phone" type="tel" placeholder="62 99999-9999" required />
          </div>
        </div>

        <div>
          <Label>Turmas (opcional — dá para cadastrar sem turma)</Label>
          <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-[var(--radius-sm)] border border-neutral-200 p-3">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="classIds"
                  value={c.id}
                  className="size-4 rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
                />
                {c.name}
              </label>
            ))}
            {classes.length === 0 ? (
              <p className="text-xs text-neutral-400">Nenhuma turma cadastrada ainda.</p>
            ) : null}
          </div>
        </div>

        <Button type="submit" isLoading={isPending} className="self-start">
          Gerar convite
        </Button>
      </form>

      {state.result?.kind === "link_created" ? (
        <Alert variant="success">
          <div className="flex flex-col gap-2">
            <p className="font-medium">
              Convite de {state.result.fullName} gerado. Copie agora — por segurança, este
              link não pode ser exibido de novo (se perder, gere um novo na lista abaixo).
            </p>
            <p className="break-all rounded bg-white/60 p-2 text-xs text-neutral-700">
              {state.result.link}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={state.result.link} label="link" />
              <CopyButton value={state.result.whatsappMessage} label="mensagem para WhatsApp" />
            </div>
          </div>
        </Alert>
      ) : null}

      {state.result?.kind === "role_granted_existing" ? (
        <Alert variant="success">
          {state.result.fullName} já tinha conta na plataforma — o papel de Professor foi
          concedido diretamente (sem link, sem mexer na senha). A pessoa já pode entrar com o
          login de sempre.
        </Alert>
      ) : null}

      {state.result?.kind === "already_teacher" ? (
        <Alert variant="warning">
          {state.result.fullName} já é professor(a) nesta plataforma. Oriente a pessoa a fazer
          login normalmente, ou use &ldquo;Gerar link de redefinição de senha&rdquo; na lista
          abaixo se ela esqueceu a senha.
        </Alert>
      ) : null}
    </div>
  );
}
