"use client";

import { useActionState } from "react";
import { respondToInvitation } from "../actions/respond";
import type { GraduationState } from "../guard";
import { FormFeedback } from "./badges";
import { Button } from "@/components/ui/Button";

/** Os dois botões do convite. Responder de novo (dentro do prazo) troca a resposta, sem duplicar. */
export function RespondForm({ editionId, current, open }: { editionId: string; current: "sem_resposta" | "confirmado" | "nao_comparece"; open: boolean }) {
  const [state, action, pending] = useActionState(respondToInvitation, {} as GraduationState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="editionId" value={editionId} />
      {current !== "sem_resposta" ? (
        <p className="text-sm text-neutral-700">
          Sua resposta atual: <strong>{current === "confirmado" ? "você confirmou presença" : "você não poderá comparecer"}</strong>.
          {open ? " Você pode mudar até o fim do prazo." : ""}
        </p>
      ) : null}
      {open ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="response" value="confirmado" variant={current === "confirmado" ? "secondary" : "primary"} isLoading={pending}>
            Confirmo minha presença
          </Button>
          <Button type="submit" name="response" value="nao_comparece" variant="secondary" isLoading={pending}>
            Não poderei comparecer
          </Button>
        </div>
      ) : null}
      <FormFeedback state={state} />
    </form>
  );
}
