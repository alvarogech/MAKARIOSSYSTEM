// Guarda no sessionStorage a questão em que o aluno está, para "Recarregar" voltar para ela (nunca falha a prova).
const keyOf = (attemptId: string) => `makarios-prova-${attemptId}-questao`;

export function saveQuestionIndex(attemptId: string, index: number): void {
  try {
    window.sessionStorage.setItem(keyOf(attemptId), String(index));
  } catch {
    // Aba privada ou armazenamento bloqueado: a prova funciona igual, só não lembra a posição.
  }
}

/** Devolve o índice guardado, ou null se não há nada, se é inválido ou se o armazenamento falha. */
export function readQuestionIndex(attemptId: string, total: number): number | null {
  try {
    const raw = window.sessionStorage.getItem(keyOf(attemptId));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 && value < total ? value : null;
  } catch {
    return null;
  }
}
