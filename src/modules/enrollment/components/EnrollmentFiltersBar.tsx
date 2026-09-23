"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ENROLLMENT_STATUS_LABELS } from "../types";

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

const fieldClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

/**
 * Busca e filtros — client component só pelo `onChange`; a busca/filtragem
 * em si acontece no servidor (a cada mudança de URL, o Server Component da
 * página refaz a query). Isso preserva o padrão do resto do projeto (sem
 * estado de dados no cliente) e mantém filtros/paginação na própria URL,
 * então atualizam automaticamente com o `router.refresh()` do tempo real.
 */
export function EnrollmentFiltersBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    params.delete("detail");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", value), 400);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[220px] flex-1">
        <Label htmlFor="enrollment-search">Buscar</Label>
        <Input
          id="enrollment-search"
          placeholder="Nome, telefone ou e-mail"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
        />
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="enrollment-period">Período</Label>
        <select
          id="enrollment-period"
          defaultValue={searchParams.get("period") ?? "all"}
          onChange={(event) => updateParam("period", event.target.value)}
          className={fieldClass}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="enrollment-volume">Volume</Label>
        <select
          id="enrollment-volume"
          defaultValue={searchParams.get("volume") ?? "all"}
          onChange={(event) => updateParam("volume", event.target.value)}
          className={fieldClass}
        >
          <option value="all">Todos</option>
          {ENROLLMENT_VOLUMES.map((volume) => (
            <option key={volume.slug} value={volume.slug}>
              {volume.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="enrollment-status">Status</Label>
        <select
          id="enrollment-status"
          defaultValue={searchParams.get("status") ?? "all"}
          onChange={(event) => updateParam("status", event.target.value)}
          className={fieldClass}
        >
          <option value="all">Todos</option>
          {Object.entries(ENROLLMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
