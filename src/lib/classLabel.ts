const SCHEDULE_SHORT: Record<string, string> = {
  "terça/quinta": "Ter/Qui",
  "terca/quinta": "Ter/Qui",
  sábado: "Sáb",
  sabado: "Sáb",
};

/** "Essência — Turma (terça/quinta)" → "Ter/Qui"; o nome do volume não se repete (aparece à parte). */
export function classScheduleLabel(className: string): string {
  const inParens = /\(([^)]+)\)/.exec(className)?.[1]?.trim().toLowerCase();
  if (inParens) return SCHEDULE_SHORT[inParens] ?? inParens;
  // Sem parênteses: tira o prefixo "Volume — " se houver.
  const afterDash = className.split("—").slice(1).join("—").trim();
  return afterDash || className;
}

/** "Essência · Sáb" — trilha + turma, sem repetir. */
export function classTagLabel(volumeName: string, className: string): string {
  return `${volumeName} · ${classScheduleLabel(className)}`;
}
