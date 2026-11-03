import { RefreshCw } from "lucide-react";
import { revalidatePath } from "next/cache";
import { buttonVariants } from "@/components/ui/Button";
import { EDITION_STATUS_LABELS } from "../ceremony";
import type { EditionView } from "../board";
import { formatDateTime } from "../dates";

async function recheck() {
  "use server";
  // Apenas recalcula: nenhum registro acadêmico é alterado.
  revalidatePath("/coordenacao/formatura", "layout");
}

/** Seletor de edição, estado da organização e botão "Reverificar situação acadêmica". */
export function EditionBar({ editions, current, computedAt }: { editions: EditionView[]; current: EditionView; computedAt?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="edicao" className="mb-1 block text-xs font-medium text-neutral-500">
            Edição
          </label>
          <select
            id="edicao"
            name="edicao"
            defaultValue={current.id}
            className="h-10 min-w-56 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
          >
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Trocar
        </button>
        <span className="mb-1 rounded-full bg-brand-blue-light px-2.5 py-1 text-xs font-medium text-brand-blue-dark">
          {EDITION_STATUS_LABELS[current.status]}
        </span>
        <span className="mb-1 text-xs text-neutral-500">Temporada {current.seasonName}</span>
      </form>

      <form action={recheck} className="flex items-center gap-3">
        {computedAt ? <span className="text-xs text-neutral-500">Calculado em {formatDateTime(computedAt)}</span> : null}
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Reverificar situação acadêmica
        </button>
      </form>
    </div>
  );
}
