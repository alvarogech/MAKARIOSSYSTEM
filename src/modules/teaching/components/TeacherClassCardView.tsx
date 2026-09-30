import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { TeacherClassCard } from "../teacherHome";

/** Card de turma reutilizado na home do professor e em "Minhas turmas". */
export function TeacherClassCardView({ klass }: { klass: TeacherClassCard }) {
  return (
    <div className="flex flex-col rounded-[var(--radius-sm)] border border-neutral-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{klass.volumeName}</p>
      <p className="mt-0.5 font-medium text-neutral-900">{klass.className}</p>
      <p className="mt-1 text-xs text-neutral-500">{klass.seasonName}</p>
      {klass.scheduleLabel ? <p className="mt-1.5 text-sm text-neutral-600">{klass.scheduleLabel}</p> : null}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
        {klass.locationLabel ?? "Local a confirmar"}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
        <Users className="size-3.5 shrink-0" aria-hidden="true" />
        {klass.studentCount} aluno{klass.studentCount === 1 ? "" : "s"} matriculado{klass.studentCount === 1 ? "" : "s"}
      </p>
      {klass.nextLesson ? (
        <p className="mt-2 text-xs text-neutral-500">
          Sua próxima aula: {klass.nextLesson.dateLabel} · {klass.nextLesson.timeLabel}
        </p>
      ) : (
        <p className="mt-2 text-xs text-neutral-400">Sem aula sua atribuída nos próximos encontros.</p>
      )}
      <Link
        href={`/professor/turmas/${klass.classId}`}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3 self-start")}
      >
        Ver turma
      </Link>
    </div>
  );
}
