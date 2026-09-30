"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonVariants } from "./Button";
import { cn } from "@/lib/cn";

/** Botão genérico "copiar para a área de transferência", com feedback visual breve. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sem permissão de clipboard no navegador: falha silenciosa, o
      // valor continua visível no texto ao lado do botão.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), className)}
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? "Copiado" : `Copiar ${label}`}
    </button>
  );
}
