import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { FrequencyAlert, FrequencyMeter } from "@/modules/attendance/components/FrequencyPanel";
import { formatHours } from "@/modules/attendance/progress";
import { loadStudentFrequency } from "@/modules/attendance/studentFrequency";
import type { LessonStatus } from "@/modules/attendance/credits";

export const metadata: Metadata = { title: "Minha frequência" };

const STATUS: Record<LessonStatus, { label: string; className: string }> = {
  presente: { label: "✓ Presente", className: "bg-green-50 text-green-700" },
  ausente: { label: "✗ Ausente", className: "bg-red-50 text-red-700" },
  atraso: { label: "◐ Atraso", className: "bg-amber-50 text-amber-700" },
  reposicao: { label: "↺ Reposição", className: "bg-brand-blue-light text-brand-blue" },
  futuro: { label: "Em breve", className: "bg-neutral-100 text-neutral-500" },
};

function dateLabel(key: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${key}T12:00:00-03:00`),
  );
}

export default async function MinhaFrequenciaPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();
  const volumes = await loadStudentFrequency(supabase, auth.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Minha frequência</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cada volume tem 16 horas de aula e exige no mínimo 75% de presença (12 horas). Aqui você acompanha suas horas, encontro
          por encontro.
        </p>
      </div>

      {volumes.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Você ainda não tem matrícula em uma turma com encontros marcados.</p>
        </Card>
      ) : null}

      {volumes.map((volume) => (
        <section key={volume.classId} className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-neutral-900">
            {volume.volumeName} <span className="font-normal text-neutral-500">· {volume.scheduleLabel}</span>
          </h2>

          <FrequencyAlert view={volume} />

          <Card className="flex flex-col gap-3">
            <FrequencyMeter view={volume} />
            <dl className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-neutral-500">Faltou até agora</dt>
                <dd className="font-semibold text-neutral-900">{formatHours(volume.progress.missedMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Ainda pode perder</dt>
                <dd className="font-semibold text-neutral-900">{formatHours(volume.progress.slackMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Precisa repor</dt>
                <dd className="font-semibold text-neutral-900">{formatHours(volume.requiredMakeupMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Encontros sem presença</dt>
                <dd className="font-semibold text-neutral-900">{volume.progress.absences}</dd>
              </div>
            </dl>
          </Card>

          <div className="flex flex-col gap-3">
            {volume.meetings.map((meeting) => (
              <Card key={meeting.id} className="p-4">
                <p className="text-sm font-semibold text-neutral-900">
                  Encontro {meeting.sequence} · {dateLabel(meeting.date)} · {meeting.start} às {meeting.end}
                </p>
                <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
                  {meeting.lessons.map((lesson) => (
                    <li key={lesson.number} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 text-neutral-800">
                        <span className="font-medium">Aula {lesson.number}</span> · {lesson.start} às {lesson.end}
                        {lesson.subject ? <span className="block text-xs text-neutral-500">{lesson.subject}</span> : null}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[lesson.status].className}`}>
                        {STATUS[lesson.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
