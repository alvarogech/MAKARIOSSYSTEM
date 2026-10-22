"use client";

import { useActionState } from "react";
import { createAnnouncement, type CreateAnnouncementState } from "../actions/createAnnouncement";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateAnnouncementState = {};

export function CreateAnnouncementForm({
  classes,
  modules,
}: {
  classes: { id: string; name: string }[];
  modules: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createAnnouncement, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Aviso publicado.</Alert> : null}

      <div>
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required />
      </div>

      <div>
        <Label htmlFor="body">Texto do aviso</Label>
        <textarea
          id="body"
          name="body"
          rows={3}
          required
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div>
        <Label htmlFor="audience">Para quem</Label>
        <select
          id="audience"
          name="audience"
          defaultValue="teachers"
          className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        >
          <option value="teachers">Professores</option>
          <option value="students">Alunos</option>
          <option value="all">Professores e alunos</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="classId">Turma específica (opcional)</Label>
          <select
            id="classId"
            name="classId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="">Todas as turmas (geral)</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="moduleId">Módulo específico (opcional)</Label>
          <select
            id="moduleId"
            name="moduleId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="">Nenhum módulo específico</option>
            {modules.map((mod) => (
              <option key={mod.id} value={mod.id}>
                {mod.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/5 p-3">
        <label className="flex items-start gap-2 text-sm font-medium text-neutral-900">
          <input type="checkbox" name="urgent" className="mt-0.5 size-4 accent-[var(--color-danger)]" />
          <span>
            Aviso importante
            <span className="block text-xs font-normal text-neutral-600">
              Aparece em destaque (banner vermelho) no topo do início dos alunos, antes de tudo.
            </span>
          </span>
        </label>
        <div className="mt-3 max-w-xs">
          <Label htmlFor="expiresOn">Mostrar até (opcional)</Label>
          <Input id="expiresOn" name="expiresOn" type="date" />
          <p className="mt-1 text-xs text-neutral-500">Depois desse dia o aviso importante sai do ar sozinho.</p>
        </div>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Publicar aviso
      </Button>
    </form>
  );
}
