"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface StudentRowView {
  key: string;
  name: string;
  waiting: boolean;
  /** Ex.: "2h de 2h realizadas · 16h no total". */
  hoursLabel: string;
  attention: boolean;
  situationLabel: string;
  situationClass: string;
  situationTitle: string;
}

type Filter = "todos" | "atencao" | "aguardando";
const PAGE = 40;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Alunos da turma: resumo, busca e filtros instantâneos. Lista única (ativos + aguardando acesso). */
export function StudentsList({ students }: { students: StudentRowView[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [limit, setLimit] = useState(PAGE);

  const waitingCount = students.filter((s) => s.waiting).length;
  const activeCount = students.length - waitingCount;
  const attentionCount = students.filter((s) => s.attention && !s.waiting).length;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return students.filter((s) => {
      if (filter === "atencao" && !(s.attention && !s.waiting)) return false;
      if (filter === "aguardando" && !s.waiting) return false;
      return !q || normalize(s.name).includes(q);
    });
  }, [students, query, filter]);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: students.length },
    { id: "atencao", label: "Em atenção", count: attentionCount },
    { id: "aguardando", label: "Aguardando acesso", count: waitingCount },
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-neutral-900">Alunos</h2>
        <p className="mt-0.5 text-sm text-neutral-700">
          {activeCount} ativos
          {waitingCount > 0 ? ` · ${waitingCount} aguardando acesso` : ""}
          {attentionCount > 0 ? ` · ${attentionCount} em atenção` : ""}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Frequência sobre as horas dos encontros já realizados, com a referência de 75%. “Atenção” = no limite ou abaixo dos 75%.
        </p>
      </div>

      <div className="relative">
        <label htmlFor="busca-aluno" className="sr-only">
          Buscar aluno pelo nome
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          id="busca-aluno"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Buscar pelo nome"
          className="h-11 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white pl-9 pr-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar alunos">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={filter === chip.id}
            onClick={() => {
              setFilter(chip.id);
              setLimit(PAGE);
            }}
            className={`min-h-9 rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
              filter === chip.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
            }`}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      <ul className="divide-y divide-neutral-100 text-sm" aria-live="polite">
        {filtered.slice(0, limit).map((s) => (
          <li key={s.key} className="flex flex-wrap items-center gap-3 py-2.5">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              {initials(s.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-neutral-900">{s.name}</span>
              <span className="block text-xs text-neutral-500">{s.waiting ? "Ainda não criou a conta" : s.hoursLabel}</span>
            </span>
            {s.waiting ? (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">aguardando acesso</span>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.situationClass}`} title={s.situationTitle}>
                {s.situationLabel}
              </span>
            )}
          </li>
        ))}
        {filtered.length === 0 ? <li className="py-3 text-neutral-500">Nenhum aluno encontrado{query ? ` para “${query}”` : ""}.</li> : null}
      </ul>

      {filtered.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit(limit + PAGE)}
          className="self-start rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400"
        >
          Mostrar mais ({filtered.length - limit})
        </button>
      ) : null}
    </Card>
  );
}
