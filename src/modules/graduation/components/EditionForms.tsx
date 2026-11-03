"use client";

import { useActionState } from "react";
import { createEdition, syncCandidates } from "../actions/editions";
import { FormFeedback } from "./badges";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { GraduationState } from "../guard";

export function CreateEditionForm({ seasons, defaultName }: { seasons: { id: string; name: string }[]; defaultName?: string }) {
  const [state, action, pending] = useActionState(createEdition, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Nome da edição</Label>
          <Input id="name" name="name" required minLength={3} maxLength={120} defaultValue={defaultName} placeholder="Formatura Makários — 2026-2" />
        </div>
        <div>
          <Label htmlFor="seasonId">Temporada de referência</Label>
          <select
            id="seasonId"
            name="seasonId"
            required
            defaultValue=""
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="" disabled>
              Escolha…
            </option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Os candidatos são os alunos com matrícula em Voz nessa temporada. A situação acadêmica de cada um é calculada a partir dos registros da plataforma;
        quem concluiu a jornada em temporadas anteriores pode ser incluído depois.
      </p>
      <FormFeedback state={state} />
      <div>
        <Button type="submit" isLoading={pending}>
          Criar edição
        </Button>
      </div>
    </form>
  );
}

export function SyncCandidatesButton({ editionId }: { editionId: string }) {
  const [state, action, pending] = useActionState(syncCandidates, {} as GraduationState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
        Atualizar lista de candidatos
      </Button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-neutral-600">{state.success}</span> : null}
    </form>
  );
}
