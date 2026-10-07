"use client";

import { useActionState, useState } from "react";
import { submitDeclaration, type DeclarationState } from "../actions/declarations";
import type { DeclarationPrompt } from "../declarations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const STATUS_TEXT = {
  pending: "Autodeclarada · em análise pela coordenação",
  validated: "Autodeclarada · confirmada pela coordenação",
  revoked: "Autodeclaração não aceita pela coordenação",
} as const;

function dateLabel(key: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(
    new Date(`${key}T12:00:00-03:00`),
  );
}

export function DeclarationCard({ prompt }: { prompt: DeclarationPrompt }) {
  const [state, action, pending] = useActionState<DeclarationState, FormData>(submitDeclaration, {});
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const title = `${prompt.volumeName} · encontro ${prompt.sequence} (${dateLabel(prompt.date)})`;

  if (prompt.declared) {
    const attended = prompt.declared.lessons.length > 0;
    return (
      <Card className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{title}</p>
        <p className="text-sm text-neutral-800">
          {attended
            ? `Você declarou que esteve nas aulas ${prompt.declared.lessons.join(", ")}.`
            : "Você declarou que não esteve neste encontro."}
        </p>
        {attended ? <p className="text-xs text-neutral-500">{STATUS_TEXT[prompt.declared.status]}</p> : null}
      </Card>
    );
  }

  const deadline = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(
    new Date(prompt.closesAt),
  );

  return (
    <Card className="flex flex-col gap-3 border-brand-blue/30 bg-brand-blue-light">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-blue uppercase">{title}</p>
        <h2 className="mt-1 font-semibold text-neutral-900">
          Você esteve no encontro {prompt.sequence} ({dateLabel(prompt.date)})?
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Houve uma falha na chamada desse dia. Conte pra gente em quais aulas você esteve — a coordenação confere. Você pode
          responder até {deadline} e só uma vez.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="meetingId" value={prompt.meetingId} />
        <input type="hidden" name="attended" value={choice ?? ""} />

        <div className="flex gap-2" role="group" aria-label="Você esteve neste encontro?">
          <Button type="button" variant={choice === "yes" ? "primary" : "secondary"} onClick={() => setChoice("yes")}>
            Sim, estive
          </Button>
          <Button type="button" variant={choice === "no" ? "primary" : "secondary"} onClick={() => setChoice("no")}>
            Não estive
          </Button>
        </div>

        {choice === "yes" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-800">Marque as aulas em que você esteve</legend>
            {prompt.lessons.map((lesson) => (
              <label
                key={lesson.number}
                className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-3 text-sm"
              >
                <input type="checkbox" name="lessons" value={lesson.number} className="mt-0.5 size-5 shrink-0 accent-brand-blue" />
                <span>
                  <span className="font-medium text-neutral-900">
                    Aula {lesson.number} · {lesson.start} às {lesson.end}
                  </span>
                  {lesson.subject ? <span className="block text-neutral-600">{lesson.subject}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {choice ? (
          <Button type="submit" isLoading={pending} className="self-start">
            Enviar resposta
          </Button>
        ) : null}
      </form>
    </Card>
  );
}
