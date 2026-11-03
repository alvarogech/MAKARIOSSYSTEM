import Link from "next/link";
import { PENDENCY_LABELS, type PendencyCategory } from "../types";
import { CONTACT_LABELS, CONTACT_STATUSES, type BoardFilters } from "../boardView";
import { OVERALL_LABELS } from "../eligibility";
import { buttonVariants } from "@/components/ui/Button";

const FIELD =
  "h-10 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

function Select({ name, label, value, children }: { name: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1 block text-xs font-medium text-neutral-500">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value} className={FIELD}>
        {children}
      </select>
    </div>
  );
}

/** Filtros combináveis. É um formulário GET: o estado vive na URL, então dá para compartilhar e voltar. */
export function FiltersBar({
  filters,
  editionId,
  action,
  turmas,
  temporadas,
  responsibles,
  hidden = {},
}: {
  filters: BoardFilters;
  editionId: string;
  action: string;
  turmas: string[];
  temporadas: string[];
  responsibles: { id: string; name: string }[];
  hidden?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4" role="search" aria-label="Filtrar candidatos">
      <input type="hidden" name="edicao" value={editionId} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="f-q" className="mb-1 block text-xs font-medium text-neutral-500">
            Buscar por nome, e-mail ou telefone
          </label>
          <input id="f-q" name="q" defaultValue={filters.q} placeholder="Ex.: Maria, maria@…, 62 9…" className={FIELD} />
        </div>
        <Select name="status" label="Situação acadêmica" value={filters.status}>
          <option value="">Todas</option>
          {Object.entries(OVERALL_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="pendencia" label="Tipo de pendência" value={filters.pendencia}>
          <option value="">Todas</option>
          {(Object.entries(PENDENCY_LABELS) as [PendencyCategory, string][]).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="quantidade" label="Quantidade de pendências" value={filters.quantidade}>
          <option value="">Qualquer</option>
          <option value="1">Só uma</option>
          <option value="2">Duas</option>
          <option value="3+">Três ou mais</option>
        </Select>
        <Select name="contato" label="Situação do contato" value={filters.contato}>
          <option value="">Todas</option>
          {CONTACT_STATUSES.map((code) => (
            <option key={code} value={code}>
              {CONTACT_LABELS[code]}
            </option>
          ))}
        </Select>
        <Select name="turma" label="Turma de Voz" value={filters.turma}>
          <option value="">Todas</option>
          {turmas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select name="temporada" label="Temporada" value={filters.temporada}>
          <option value="">Todas</option>
          {temporadas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select name="responsavel" label="Responsável" value={filters.responsavel}>
          <option value="">Todos</option>
          <option value="sem">Sem responsável</option>
          {responsibles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Aplicar filtros
        </button>
        <Link href={`${action}?edicao=${editionId}${Object.entries(hidden).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("")}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Limpar
        </Link>
      </div>
    </form>
  );
}
