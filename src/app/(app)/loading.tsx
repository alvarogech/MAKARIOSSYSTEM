/** Esqueleto mostrado enquanto uma página da área logada carrega (em vez de tela em branco). */
export default function Loading() {
  const block = "rounded-[var(--radius-lg)] bg-neutral-200/70 motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <div className={`${block} h-7 w-48`} />
        <div className={`${block} h-4 w-32`} />
      </div>
      <div className={`${block} h-44`} />
      <div className={`${block} h-24`} />
      <div className={`${block} h-32`} />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
