"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ENROLLMENT_GR_NETWORKS, ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ENROLLMENT_CHURCH_VINCULO_LABELS, ENROLLMENT_STATUS_LABELS } from "../types";

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
 * `de`/`ate` (intervalo de data explícito, usado ao clicar no gráfico) são
 * sempre limpos quando qualquer filtro aqui muda, para não deixar dois
 * filtros de data conflitantes ativos ao mesmo tempo.
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

  function updateParam(key: string, value: string, options?: { keepDateRange?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (!options?.keepDateRange) {
      params.delete("de");
      params.delete("ate");
    }
    params.delete("page");
    params.delete("detail");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", value, { keepDateRange: true }), 400);
  }

  function toggleNotViewed(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("naoVistas", "1");
    else params.delete("naoVistas");
    params.delete("page");
    params.delete("detail");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="enrollment-search">Buscar</Label>
          <Input
            id="enrollment-search"
            placeholder="Nome, telefone ou e-mail"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
          />
        </div>
        <div className="min-w-[150px] flex-1 sm:flex-none">
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
        <div className="min-w-[140px] flex-1 sm:flex-none">
          <Label htmlFor="enrollment-volume">Curso</Label>
          <select
            id="enrollment-volume"
            defaultValue={searchParams.get("volume") ?? "all"}
            onChange={(event) => updateParam("volume", event.target.value, { keepDateRange: true })}
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
        <div className="min-w-[140px] flex-1 sm:flex-none">
          <Label htmlFor="enrollment-schedule">Turma</Label>
          <select
            id="enrollment-schedule"
            defaultValue={searchParams.get("schedule") ?? "all"}
            onChange={(event) => updateParam("schedule", event.target.value, { keepDateRange: true })}
            className={fieldClass}
          >
            <option value="all">Todas</option>
            {ENROLLMENT_SCHEDULES.map((schedule) => (
              <option key={schedule.slug} value={schedule.slug}>
                {schedule.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1 sm:flex-none">
          <Label htmlFor="enrollment-status">Status</Label>
          <select
            id="enrollment-status"
            defaultValue={searchParams.get("status") ?? "all"}
            onChange={(event) => updateParam("status", event.target.value, { keepDateRange: true })}
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

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[160px] flex-1 sm:flex-none">
          <Label htmlFor="enrollment-vinculo">Vínculo com a igreja</Label>
          <select
            id="enrollment-vinculo"
            defaultValue={searchParams.get("vinculo") ?? "all"}
            onChange={(event) => updateParam("vinculo", event.target.value, { keepDateRange: true })}
            className={fieldClass}
          >
            <option value="all">Todos</option>
            {Object.entries(ENROLLMENT_CHURCH_VINCULO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px] flex-1 sm:flex-none">
          <Label htmlFor="enrollment-rede">Rede de GR</Label>
          <select
            id="enrollment-rede"
            defaultValue={searchParams.get("rede") ?? "all"}
            onChange={(event) => updateParam("rede", event.target.value, { keepDateRange: true })}
            className={fieldClass}
          >
            <option value="all">Todas</option>
            {ENROLLMENT_GR_NETWORKS.map((network) => (
              <option key={network.slug} value={network.slug}>
                {network.label}
              </option>
            ))}
            <option value="sem_gr">Sem GR</option>
            <option value="nao_informado">Não informado</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-neutral-600">
          <input
            type="checkbox"
            className="size-4 rounded border-neutral-300 accent-brand-blue"
            checked={searchParams.get("naoVistas") === "1"}
            onChange={(event) => toggleNotViewed(event.target.checked)}
          />
          Só não visualizadas
        </label>
      </div>
    </div>
  );
}
