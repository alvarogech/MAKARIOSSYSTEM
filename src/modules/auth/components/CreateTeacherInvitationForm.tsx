"use client";

import { useActionState } from "react";
import {
  createTeacherInvitation,
  type CreateTeacherInvitationState,
} from "../actions/createTeacherInvitation";
import type { AssignableLesson } from "../assignableLessons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { CopyButton } from "@/components/ui/CopyButton";

const initialState: CreateTeacherInvitationState = {};

function formatLessonDate(isoDate: string): string {
  if (!isoDate) return "";
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function groupLessons(lessons: AssignableLesson[]): Map<string, AssignableLesson[]> {
  const groups = new Map<string, AssignableLesson[]>();
  for (const lesson of lessons) {
    const key = `${lesson.volumeName} — ${lesson.className}`;
    const list = groups.get(key) ?? [];
    list.push(lesson);
    groups.set(key, list);
  }
  return groups;
}

export function CreateTeacherInvitationForm({ lessons }: { lessons: AssignableLesson[] }) {
  const [state, formAction, isPending] = useActionState(
    createTeacherInvitation,
    initialState,
  );
  const groups = groupLessons(lessons);

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
          <Label>
            Aulas que esta pessoa vai dar (opcional — dá para cadastrar sem aula ainda)
          </Label>
          <p className="mt-1 text-xs text-neutral-500">
            Só aparecem aulas que ainda não têm professor. A turma é vinculada
            automaticamente a partir das aulas escolhidas.
          </p>
          <div className="mt-2 flex max-h-64 flex-col gap-3 overflow-y-auto rounded-[var(--radius-sm)] border border-neutral-200 p-3">
            {[...groups.entries()].map(([groupLabel, groupLessons]) => (
              <div key={groupLabel}>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {groupLabel}
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {groupLessons.map((lesson) => (
                    <label
                      key={lesson.blockId}
                      className="flex items-center gap-2 text-sm text-neutral-700"
                    >
                      <input
                        type="checkbox"
                        name="meetingBlockIds"
                        value={lesson.blockId}
                        className="size-4 rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
                      />
                      {formatLessonDate(lesson.meetingDate)} — {lesson.moduleName}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {lessons.length === 0 ? (
              <p className="text-xs text-neutral-400">
                Nenhuma aula sem professor no momento.
              </p>
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
