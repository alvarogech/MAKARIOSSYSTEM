"use client";

import { useActionState, useState } from "react";
import {
  createReleaseRule,
  type CreateReleaseRuleState,
} from "../actions/createReleaseRule";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateReleaseRuleState = {};

export function CreateReleaseRuleForm({
  contents,
  activities,
}: {
  contents: { groupLabel: string; options: { id: string; label: string }[] }[];
  activities: { groupLabel: string; options: { id: string; label: string }[] }[];
}) {
  const [state, formAction, isPending] = useActionState(createReleaseRule, initialState);
  const [type, setType] = useState("immediate");

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Regra de liberação criada.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rule-contentId">Conteúdo</Label>
          <select
            id="rule-contentId"
            name="contentId"
            required
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {contents.map((group) => (
              <optgroup key={group.groupLabel} label={group.groupLabel}>
                {group.options.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="rule-type">Tipo de regra</Label>
          <select
            id="rule-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="immediate">Imediata</option>
            <option value="date">Por data</option>
            <option value="manual">Manual</option>
            <option value="after_content">Após concluir outro conteúdo</option>
            <option value="after_activity">Após enviar um exercício</option>
          </select>
        </div>
      </div>

      {type === "date" ? (
        <div>
          <Label htmlFor="rule-releaseAt">Data/hora de liberação</Label>
          <Input id="rule-releaseAt" name="releaseAt" type="datetime-local" />
        </div>
      ) : null}

      {type === "after_content" ? (
        <div>
          <Label htmlFor="rule-requiredContentId">Conteúdo pré-requisito</Label>
          <select
            id="rule-requiredContentId"
            name="requiredContentId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {contents.map((group) => (
              <optgroup key={group.groupLabel} label={group.groupLabel}>
                {group.options.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}

      {type === "after_activity" ? (
        <div>
          <Label htmlFor="rule-requiredActivityId">Exercício pré-requisito</Label>
          <select
            id="rule-requiredActivityId"
            name="requiredActivityId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {activities.map((group) => (
              <optgroup key={group.groupLabel} label={group.groupLabel}>
                {group.options.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar regra
      </Button>
    </form>
  );
}
