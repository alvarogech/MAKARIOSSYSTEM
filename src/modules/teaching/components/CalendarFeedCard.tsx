"use client";

import { useState, useTransition } from "react";
import { CalendarSync } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createCalendarFeedLink, disableCalendarFeed } from "../actions/calendarFeed";

/** Assinar o calendário: um link secreto que mantém Google Calendar / iPhone atualizados sozinhos. */
export function CalendarFeedCard({ hasFeed }: { hasFeed: boolean }) {
  const [active, setActive] = useState(hasFeed);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createCalendarFeedLink();
      if (res.error || !res.url) return setError(res.error ?? "Não foi possível gerar o link.");
      setUrl(res.url);
      setActive(true);
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      const res = await disableCalendarFeed();
      if (res.error) return setError(res.error);
      setUrl(null);
      setActive(false);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o link e copie.");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <CalendarSync className="mt-0.5 size-5 shrink-0 text-neutral-400" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-neutral-900">Assinar no seu calendário</h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            Gere um link e adicione ao Google Calendar ou ao iPhone: suas aulas aparecem e se atualizam sozinhas quando a coordenação remarcar.
          </p>
        </div>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {url ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <label htmlFor="feed-url" className="text-xs font-medium text-neutral-600">
            Seu link secreto (aparece só agora — não compartilhe)
          </label>
          <input id="feed-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-2 text-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              {copied ? "Copiado ✓" : "Copiar link"}
            </Button>
          </div>
          <ul className="list-disc pl-5 text-xs text-neutral-600">
            <li>
              <strong>Google Calendar (computador):</strong> Outras agendas → “+” → <em>Do URL</em> → cole o link.
            </li>
            <li>
              <strong>iPhone:</strong> Ajustes → Calendário → Contas → Adicionar conta → Outra → <em>Adicionar calendário assinado</em>.
            </li>
            <li>O Google pode levar algumas horas para refletir mudanças.</li>
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={active ? "secondary" : "primary"} onClick={generate} isLoading={pending}>
          {active ? "Gerar novo link" : "Gerar link do calendário"}
        </Button>
        {active ? (
          <Button size="sm" variant="ghost" onClick={disable} disabled={pending}>
            Desativar
          </Button>
        ) : null}
      </div>
      {active && !url ? (
        <p className="text-xs text-neutral-500">
          Calendário ativo. Por segurança o link não é mostrado de novo — gere um novo se precisar assinar em outro aparelho (o anterior deixa de funcionar).
        </p>
      ) : null}
    </Card>
  );
}
