"use client";

import { useState, useTransition } from "react";
import { Check, Mail } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { sendStudentAccessEmail } from "../actions/sendStudentAccessEmail";

/** Reenvia por e-mail o link de criar a conta (o mesmo do botão do WhatsApp). */
export function SendAccessEmailButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setSentTo(null);
    startTransition(async () => {
      const result = await sendStudentAccessEmail(requestId);
      if (result.ok) setSentTo(result.email);
      else setError(result.error);
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-brand-blue/30 bg-brand-blue/10 px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/20 disabled:opacity-60"
      >
        {pending ? <Spinner className="size-3.5" /> : <Mail className="size-3.5" aria-hidden="true" />}
        {pending ? "Enviando…" : "Reenviar acesso por e-mail"}
      </button>
      {sentTo ? (
        <span role="status" className="inline-flex items-center gap-1 text-xs text-success">
          <Check className="size-3.5" aria-hidden="true" />
          Enviado para {sentTo}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
