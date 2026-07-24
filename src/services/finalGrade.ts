/**
 * "A nota da recuperação substitui a nota regular apenas quando for
 * maior" (doc 02 §8). Espelha `greatest(coalesce(final_grade,0), score)`
 * em `private.finalize_attempt_scoring` (SQL).
 */
export function resolveFinalGrade(
  regularScore: number | null,
  recoveryScore: number | null,
): number | null {
  if (regularScore === null && recoveryScore === null) {
    return null;
  }
  return Math.max(regularScore ?? 0, recoveryScore ?? 0);
}
