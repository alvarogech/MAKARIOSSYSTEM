import { Alert } from "@/components/ui/Alert";
import { formatHours } from "../progress";
import type { FrequencyView } from "../studentFrequency";

/** Mensagem acolhedora (e a cor do alerta) conforme a situação de frequência. */
export function frequencyAlert(view: FrequencyView): { variant: "success" | "info" | "warning" | "danger"; title: string; text: string } {
  const { progress, requiredMakeupMinutes } = view;
  switch (progress.situation) {
    case "reprovado":
      return {
        variant: "danger",
        title: "Atenção: sua frequência está abaixo dos 75%",
        text:
          `Pelas faltas até agora, você não alcança os 75% exigidos para a formatura sem repor. ` +
          `Faltam repor cerca de ${formatHours(requiredMakeupMinutes)}. Para repor, assista ao encontro correspondente em outra ` +
          `turma do mesmo volume (leia o QR Code da sala) e fale com a coordenação — a gente te ajuda a organizar.`,
      };
    case "no_limite":
      return {
        variant: "warning",
        title: "Você está no limite das faltas",
        text: "Mais uma falta e você não atinge os 75% de frequência exigidos para a formatura. Se precisar faltar, procure a coordenação antes para combinarmos a reposição.",
      };
    case "atencao":
      return {
        variant: "info",
        title: "Você já faltou, mas ainda está dentro",
        text: `Você ainda pode perder cerca de ${formatHours(progress.slackMinutes)} sem comprometer os 75%. Se faltar, vale combinar a reposição.`,
      };
    default:
      return {
        variant: "success",
        title: "Frequência em dia",
        text: `Tudo certo! Você ainda pode perder até ${formatHours(view.allowedMissMinutes)} ao longo do volume sem comprometer os 75%.`,
      };
  }
}

export function FrequencyAlert({ view }: { view: FrequencyView }) {
  const alert = frequencyAlert(view);
  return (
    <Alert variant={alert.variant}>
      <div>
        <p className="font-semibold">{alert.title}</p>
        <p className="mt-0.5">{alert.text}</p>
      </div>
    </Alert>
  );
}

/** Barra de horas cumpridas com a linha dos 75% marcada. */
export function FrequencyMeter({ view }: { view: FrequencyView }) {
  const { progress } = view;
  const total = progress.totalMinutes || 1;
  const pctOfTotal = Math.min(100, Math.round((progress.attendedMinutes / total) * 100));
  const pctSoFar = view.heldMinutes > 0 ? Math.round((progress.attendedMinutes / view.heldMinutes) * 100) : null;
  const barColor =
    progress.situation === "reprovado" ? "bg-danger" : progress.situation === "no_limite" ? "bg-amber-500" : "bg-brand-blue";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold text-neutral-900">
          {formatHours(progress.attendedMinutes)} <span className="text-base font-normal text-neutral-500">de {formatHours(progress.totalMinutes)}</span>
        </p>
        <p className="text-sm text-neutral-600">
          {pctOfTotal}% do volume
          {pctSoFar !== null ? ` · ${pctSoFar}% dos encontros já realizados` : ""}
        </p>
      </div>
      <div
        className="relative mt-3 h-3 w-full rounded-full bg-neutral-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pctOfTotal}
        aria-label={`Horas cumpridas: ${pctOfTotal}% do volume`}
      >
        <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${pctOfTotal}%` }} />
        <div className="absolute inset-y-[-4px] w-0.5 bg-neutral-700" style={{ left: "75%" }} aria-hidden="true" />
      </div>
      <p className="mt-1 text-right text-[11px] text-neutral-500" style={{ paddingRight: "20%" }}>
        mínimo 75% ({formatHours(Math.ceil(progress.totalMinutes * 0.75))})
      </p>
    </div>
  );
}
