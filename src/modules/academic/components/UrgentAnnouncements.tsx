import { AlertTriangle } from "lucide-react";
import type { StudentAnnouncement } from "../announcements";

/** Avisos importantes do aluno: banner grande, vermelho, no topo do início. Some sozinho na data de saída do aviso. */
export function UrgentAnnouncements({ items }: { items: Pick<StudentAnnouncement, "id" | "title" | "body">[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Avisos importantes" className="flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          role="alert"
          className="rounded-[var(--radius-lg)] border-2 border-danger bg-danger/10 p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <AlertTriangle className="mt-0.5 size-7 shrink-0 text-danger sm:size-9" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-danger">Aviso importante</p>
              <h2 className="mt-1 break-words text-xl font-extrabold leading-tight text-neutral-900 sm:text-2xl">{item.title}</h2>
              <p className="mt-2 whitespace-pre-line break-words text-base font-semibold text-neutral-900 sm:text-lg">{item.body}</p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
