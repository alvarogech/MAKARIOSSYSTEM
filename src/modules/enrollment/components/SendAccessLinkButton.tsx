"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { shareStudentAccessLink } from "../actions/shareStudentAccessLink";

/**
 * Abre o WhatsApp do aluno com o link de criar a conta já escrito. A janela é
 * aberta ainda no clique (antes de esperar o servidor) porque o Safari bloqueia
 * janela aberta depois de um await.
 */
export function SendAccessLinkButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const result = await shareStudentAccessLink(requestId);
      if (!result.ok) {
        tab?.close();
        setError(result.error);
        return;
      }
      setLink(result.link);
      if (result.whatsappUrl && tab) {
        tab.opener = null;
        tab.location.href = result.whatsappUrl;
      } else {
        tab?.close();
      }
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-60"
      >
        {pending ? <Spinner className="size-3.5" /> : <MessageCircle className="size-3.5" aria-hidden="true" />}
        Mandar acesso pelo WhatsApp
      </button>
      {link ? <CopyButton value={link} label="link de acesso" /> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
