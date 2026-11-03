"use client";

import { useActionState } from "react";
import { validateHistoryBulk } from "../actions/history";
import type { GraduationState } from "../guard";
import { MODULE_LABELS, MODULES } from "../types";
import { FormFeedback } from "./badges";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

/** Só administrador. Um registro por aluno e módulo, com a mesma origem e evidência informadas aqui. */
export function BulkHistoryForm({ ids }: { ids: string[] }) {
  const [state, action, pending] = useActionState(validateHistoryBulk, {} as GraduationState);
  return (
    <details className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-neutral-800">Validar histórico dos {ids.length} selecionado(s) (administrador)</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        {ids.map((id) => (
          <input key={id} type="hidden" name="studentIds" value={id} />
        ))}
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1 text-xs font-medium text-neutral-500">Módulos concluídos antes da plataforma</legend>
          {MODULES.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" name="modules" value={m} className="size-4 accent-brand-blue" />
              {MODULE_LABELS[m]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="bh-season">Temporada (se souber)</Label>
            <Input id="bh-season" name="seasonLabel" maxLength={60} placeholder="Ex.: 2026.1" />
          </div>
          <div>
            <Label htmlFor="bh-origin">Origem da informação</Label>
            <Input id="bh-origin" name="origin" required minLength={3} maxLength={300} placeholder="Ex.: lista de presença de Caminho 2026.1" />
          </div>
        </div>
        <div>
          <Label htmlFor="bh-evidence">Evidência</Label>
          <textarea
            id="bh-evidence"
            name="evidence"
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
            placeholder="O que você conferiu e onde está o documento."
          />
        </div>
        <p className="text-xs text-neutral-500">Use só depois de conferir cada aluno na evidência. O que se declara na inscrição, sozinho, não comprova a conclusão.</p>
        <FormFeedback state={state} />
        <div>
          <Button type="submit" size="sm" isLoading={pending}>
            Registrar o histórico
          </Button>
        </div>
      </form>
    </details>
  );
}
