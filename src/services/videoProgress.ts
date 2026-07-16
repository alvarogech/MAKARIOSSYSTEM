/**
 * Cálculo de progresso de vídeo (doc 02 §4). Função pura — a integração
 * real com a YouTube IFrame Player API só chama isto para decidir o que
 * persistir.
 */

export interface VideoProgressInput {
  positionSeconds: number;
  durationSeconds: number;
  /** Percentual mínimo para considerar concluído (padrão 80 — doc 02 §4.5). */
  minPercent: number;
}

export interface VideoProgressResult {
  percent: number;
  isCompleted: boolean;
}

export function computeVideoProgress({
  positionSeconds,
  durationSeconds,
  minPercent,
}: VideoProgressInput): VideoProgressResult {
  if (durationSeconds <= 0) {
    return { percent: 0, isCompleted: false };
  }

  const rawPercent = (positionSeconds / durationSeconds) * 100;
  const percent = Math.round(Math.min(100, Math.max(0, rawPercent)) * 100) / 100;

  return { percent, isCompleted: percent >= minPercent };
}

/**
 * O progresso salvo nunca regride: se o aluno voltar o vídeo, o percentual
 * já alcançado antes permanece registrado.
 */
export function mergeProgressPercent(
  previousPercent: number,
  newPercent: number,
): number {
  return Math.max(previousPercent, newPercent);
}
