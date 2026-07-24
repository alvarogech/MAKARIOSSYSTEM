"use client";

import { useActionState, useState } from "react";
import {
  addRecoveryPathItem,
  type AddRecoveryPathItemState,
} from "../actions/addRecoveryPathItem";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: AddRecoveryPathItemState = {};

export function AddRecoveryPathItemForm({
  recoveryAssessments,
  contents,
  activities,
}: {
  recoveryAssessments: { id: string; label: string }[];
  contents: { id: string; label: string }[];
  activities: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    addRecoveryPathItem,
    initialState,
  );
  const [kind, setKind] = useState<"content" | "activity">("content");

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Item adicionado à trilha de revisão.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="rp-assessmentId">Recuperação</Label>
          <select
            id="rp-assessmentId"
            name="assessmentId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {recoveryAssessments.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="rp-kind">Tipo do item</Label>
          <select
            id="rp-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "content" | "activity")}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="content">Conteúdo</option>
            <option value="activity">Exercício</option>
          </select>
        </div>
        <div>
          <Label htmlFor="rp-orderIndex">Posição</Label>
          <Input id="rp-orderIndex" name="orderIndex" type="number" min={1} required />
        </div>
      </div>

      {kind === "content" ? (
        <div>
          <Label htmlFor="rp-contentId">Conteúdo</Label>
          <select
            id="rp-contentId"
            name="contentId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {contents.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <Label htmlFor="rp-activityId">Exercício</Label>
          <select
            id="rp-activityId"
            name="activityId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {activities.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" isLoading={isPending} className="self-start">
        Adicionar à trilha
      </Button>
    </form>
  );
}
