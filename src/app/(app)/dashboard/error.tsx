"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/ErrorState";

/** Falha ao montar o Início: mantém o menu da plataforma e oferece tentar de novo (em vez de derrubar a tela toda). */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Não foi possível carregar o início"
      description="Tente novamente em instantes. Se o problema continuar, avise a coordenação."
      onRetry={reset}
    />
  );
}
