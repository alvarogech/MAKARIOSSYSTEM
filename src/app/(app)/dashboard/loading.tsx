/** Esqueleto do Início enquanto os dados carregam: saudação, destaque do próximo dia de aula e os blocos da página. */
export default function DashboardLoading() {
  const block = "rounded-[var(--radius-lg)] bg-neutral-200/70 motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Carregando o início">
      <div className={`${block} h-24`} />
      <div className={`${block} h-56 border-l-4 border-brand-blue/40`} />
      <div className={`${block} h-32`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${block} h-48`} />
        <div className={`${block} h-48`} />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
