"use client";

import { useActionState, useState } from "react";
import { createQuestion, type CreateQuestionState } from "../actions/createQuestion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateQuestionState = {};

export function CreateQuestionForm({
  lessons,
}: {
  lessons: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createQuestion, initialState);
  const [type, setType] = useState("multiple_choice");

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Questão criada.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="q-lessonId">Aula (opcional)</Label>
          <select
            id="q-lessonId"
            name="lessonId"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="">Nenhuma</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="q-type">Tipo</Label>
          <select
            id="q-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="multiple_choice">Múltipla escolha</option>
            <option value="true_false">Verdadeiro ou falso</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="q-prompt">Enunciado</Label>
        <textarea
          id="q-prompt"
          name="prompt"
          required
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      {type === "multiple_choice" ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
          <p className="text-xs font-medium text-neutral-500">
            Alternativas (preencha ao menos duas e marque a correta)
          </p>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <input type="radio" name="correctOptionIndex" value={n} required={n === 1} />
              <Input name={`optionLabel${n}`} placeholder={`Alternativa ${n}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="trueFalseCorrect" value="true" required /> Verdadeiro é a correta
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="trueFalseCorrect" value="false" /> Falso é a correta
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="q-topic">Tema (opcional)</Label>
          <Input id="q-topic" name="topic" />
        </div>
        <div>
          <Label htmlFor="q-bibleReference">Referência bíblica (opcional)</Label>
          <Input id="q-bibleReference" name="bibleReference" />
        </div>
        <div>
          <Label htmlFor="q-difficulty">Dificuldade</Label>
          <select
            id="q-difficulty"
            name="difficulty"
            defaultValue="medio"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="facil">Fácil</option>
            <option value="medio">Média</option>
            <option value="dificil">Difícil</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="q-explanation">Explicação exibida após o envio (opcional)</Label>
        <textarea
          id="q-explanation"
          name="explanation"
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Criar questão
      </Button>
    </form>
  );
}
