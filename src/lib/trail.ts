/** Cor discreta de cada trilha. As classes são literais para o Tailwind gerá-las. */
export interface TrailStyle {
  dot: string;
  tag: string;
}

const STYLES: Record<string, TrailStyle> = {
  essencia: { dot: "bg-trail-essencia", tag: "bg-trail-essencia/10 text-trail-essencia" },
  caminho: { dot: "bg-trail-caminho", tag: "bg-trail-caminho/10 text-trail-caminho" },
  voz: { dot: "bg-trail-voz", tag: "bg-trail-voz/10 text-trail-voz" },
};

const FALLBACK: TrailStyle = { dot: "bg-neutral-400", tag: "bg-neutral-100 text-neutral-600" };

const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function trailStyle(volumeName: string): TrailStyle {
  return STYLES[normalize(volumeName)] ?? FALLBACK;
}
