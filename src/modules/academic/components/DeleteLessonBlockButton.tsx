"use client";

import { useActionState } from "react";
import { deleteLessonBlock, type DeleteLessonBlockState } from "../actions/assignLessonBlock";
import { Button } from "@/components/ui/Button";

const initialState: DeleteLessonBlockState = {};

export function DeleteLessonBlockButton({ blockId }: { blockId: string }) {
  const [state, formAction, isPending] = useActionState(deleteLessonBlock, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="blockId" value={blockId} />
      <Button type="submit" variant="ghost" size="sm" isLoading={isPending}>
        Remover
      </Button>
      {state.error ? <span className="ml-2 text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
