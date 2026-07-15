/**
 * Regra de pré-requisito (doc 02 §2). Função pura — recebe o grafo de
 * pré-requisitos e o estado do aluno já carregados pela camada de dados,
 * decide, e não sabe nada sobre Postgres/Supabase. Testável isoladamente.
 */

export interface PrerequisiteCheckResult {
  satisfied: boolean;
  missingVolumeIds: string[];
}

/**
 * @param targetVolumeId Volume em que o aluno está tentando matricular.
 * @param prerequisitesByVolume Mapa volume → lista de pré-requisitos diretos.
 * @param approvedVolumeIds Volumes que o aluno já concluiu (matrícula com status = 'approved').
 * @param exceptionVolumeIds Pré-requisitos especificamente perdoados por exceção da coordenação
 *   (cada item é o id do volume-pré-requisito que foi perdoado, não o volume alvo).
 */
export function checkPrerequisites(
  targetVolumeId: string,
  prerequisitesByVolume: Readonly<Record<string, readonly string[]>>,
  approvedVolumeIds: ReadonlySet<string>,
  exceptionVolumeIds: ReadonlySet<string> = new Set(),
): PrerequisiteCheckResult {
  const required = prerequisitesByVolume[targetVolumeId] ?? [];

  const missingVolumeIds = required.filter(
    (prerequisiteId) =>
      !approvedVolumeIds.has(prerequisiteId) &&
      !exceptionVolumeIds.has(prerequisiteId),
  );

  return {
    satisfied: missingVolumeIds.length === 0,
    missingVolumeIds,
  };
}
