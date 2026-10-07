import type { Situation } from "./progress";

/** Rótulo e cor de cada situação de frequência — usado na coordenação, no professor e no aluno. */
export const SITUATION: Record<Situation, { label: string; className: string }> = {
  em_dia: { label: "Em dia", className: "bg-green-50 text-green-700" },
  atencao: { label: "Atenção", className: "bg-amber-50 text-amber-700" },
  no_limite: { label: "No limite", className: "bg-orange-50 text-orange-700" },
  reprovado: { label: "Reprovado por frequência", className: "bg-red-50 text-red-700" },
};
