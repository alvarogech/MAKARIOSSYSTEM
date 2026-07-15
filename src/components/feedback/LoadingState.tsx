import { Spinner } from "@/components/ui/Spinner";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-neutral-500"
    >
      <Spinner className="size-8 text-brand-blue" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
