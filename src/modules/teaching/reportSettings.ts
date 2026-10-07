/**
 * Relatório pós-aula: regra única de quando ele existe e quando abre.
 * Toda tela, pendência e alerta decide por estas funções — nada de checagem espalhada.
 */

export type ReportState = "inactive" | "not_scheduled" | "not_over" | "open";

/** O semestre exige o relatório pós-aula? (desligado por padrão) */
export function isRelatorioAtivo(season: { require_class_report?: boolean | null } | null | undefined): boolean {
  return season?.require_class_report === true;
}

/** O encontro já terminou (data + horário de término, no horário de São Paulo)? */
export function isMeetingOver(dateKey: string | null, endTime: string | null, now: Date): boolean {
  if (!dateKey || !endTime) return false;
  const end = new Date(`${dateKey}T${endTime.slice(0, 8).padEnd(8, ":00").slice(0, 8)}-03:00`).getTime();
  return Number.isFinite(end) && end <= now.getTime();
}

/** Estado do relatório para um professor em um encontro. A ordem importa: desligado vence tudo. */
export function reportState(input: { active: boolean; scheduled: boolean; over: boolean }): ReportState {
  if (!input.active) return "inactive";
  if (!input.scheduled) return "not_scheduled";
  if (!input.over) return "not_over";
  return "open";
}
