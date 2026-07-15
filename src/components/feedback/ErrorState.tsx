import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível concluir esta ação. Tente novamente em instantes.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertTriangle className="size-10 text-danger" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="max-w-sm text-sm text-neutral-500">{description}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
