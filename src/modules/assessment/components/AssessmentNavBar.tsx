"use client";

// Botões Anterior, Próxima e Revisar e enviar da prova, bloqueados enquanto há resposta marcada sem confirmar.
import { Button } from "@/components/ui/Button";

export function AssessmentNavBar({
  index,
  total,
  locked,
  describedBy,
  onPrevious,
  onNext,
  onReview,
}: {
  index: number;
  total: number;
  locked: boolean;
  describedBy?: string;
  onPrevious: () => void;
  onNext: () => void;
  onReview: () => void;
}) {
  const isLast = index >= total - 1;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={locked || index === 0} aria-describedby={locked ? describedBy : undefined} onClick={onPrevious}>
        Anterior
      </Button>
      {isLast ? (
        <Button variant="secondary" disabled={locked} aria-describedby={locked ? describedBy : undefined} onClick={onReview}>
          Revisar e enviar
        </Button>
      ) : (
        <>
          <Button variant="secondary" disabled={locked} aria-describedby={locked ? describedBy : undefined} onClick={onNext}>
            Próxima
          </Button>
          <Button variant="ghost" disabled={locked} aria-describedby={locked ? describedBy : undefined} onClick={onReview}>
            Revisar e enviar
          </Button>
        </>
      )}
    </div>
  );
}
