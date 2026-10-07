import { Card } from "@/components/ui/Card";
import type { VolumeJourney } from "../journey";
import { JourneyStage } from "./JourneyStage";

/** O caminho de um volume: etapas em ordem, com o progresso em texto (sem ranking, sem pontos). */
export function ModuleJourney({ journey }: { journey: VolumeJourney }) {
  const total = journey.stages.length;
  if (total === 0) return null;
  const headingId = `jornada-${journey.enrollmentId}`;
  const percent = Math.round((journey.concluded / total) * 100);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={headingId} className="text-base font-semibold text-neutral-900">
            Seu caminho em {journey.volumeName}
          </h2>
          <p className="text-sm text-neutral-600">
            {journey.concluded} de {total} etapas concluídas
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={journey.concluded}
          aria-label={`Etapas concluídas em ${journey.volumeName}`}
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        >
          <div className="h-full rounded-full bg-brand-blue transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-neutral-500">
          Cada etapa é uma matéria. Faça no seu ritmo: o caminho só mostra onde você está e o que vem a seguir — presença, notas e prazos seguem as regras de sempre.
        </p>
      </Card>

      <ol className="relative flex flex-col gap-3 before:absolute before:bottom-6 before:left-[17px] before:top-6 before:w-0.5 before:bg-neutral-200">
        {journey.stages.map((stage, index) => (
          <JourneyStage key={stage.moduleId} stage={stage} current={index === journey.currentIndex} />
        ))}
      </ol>
    </section>
  );
}
