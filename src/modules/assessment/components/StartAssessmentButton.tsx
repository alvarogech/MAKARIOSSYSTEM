"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAssessmentAttempt } from "../actions/attemptActions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function StartAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleStart() {
    setIsPending(true);
    setError(null);
    const res = await startAssessmentAttempt(assessmentId);
    setIsPending(false);

    if (!res.ok) {
      setError(res.error ?? "Não foi possível iniciar a avaliação.");
      return;
    }

    router.push(`/avaliacoes/${assessmentId}/prova`);
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Button type="button" isLoading={isPending} onClick={handleStart} className="self-start">
        Iniciar avaliação
      </Button>
    </div>
  );
}
