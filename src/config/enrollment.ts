export const ENROLLMENT_LOCATION = {
  name: "UNEED University",
  address: "Av. T-1, 1470 - Setor Bueno, Goiânia - GO, 74210-098",
  mapsUrl: "https://maps.app.goo.gl/wFxPL1hSFoBckoFT6",
} as const;

export const ENROLLMENT_SCHEDULES = [
  {
    slug: "terca_quinta",
    label: "Terças e quintas",
    time: "19h30 às 21h50",
    summary: "8 encontros presenciais",
  },
  {
    slug: "sabado",
    label: "Sábados",
    time: "8h às 12h30",
    summary: "4 encontros presenciais",
  },
] as const;

export const ENROLLMENT_VOLUMES = [
  { slug: "essencia", label: "Essência", order: 1 },
  { slug: "caminho", label: "Caminho", order: 2 },
  { slug: "voz", label: "Voz", order: 3 },
] as const;

export const ENROLLMENT_PRIVACY_TERMS_VERSION = "2026-09-22";

export type EnrollmentVolumeSlug = (typeof ENROLLMENT_VOLUMES)[number]["slug"];
export type EnrollmentScheduleSlug = (typeof ENROLLMENT_SCHEDULES)[number]["slug"];

