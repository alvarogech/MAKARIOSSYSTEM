import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";

/** Rótulos compartilhados entre tabela, painel de detalhes e exportação CSV. */
export function volumeLabel(slug: string | null): string {
  if (!slug) return "";
  return ENROLLMENT_VOLUMES.find((volume) => volume.slug === slug)?.label ?? slug;
}

export function scheduleLabel(slug: string | null): string {
  if (!slug) return "";
  return ENROLLMENT_SCHEDULES.find((schedule) => schedule.slug === slug)?.label ?? slug;
}
