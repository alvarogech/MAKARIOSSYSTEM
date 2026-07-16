"use client";

import { useActionState } from "react";
import { publishContent, type PublishContentState } from "../actions/publishContent";
import { Button } from "@/components/ui/Button";

const initialState: PublishContentState = {};

export function PublishContentButton({
  contentId,
  currentStatus,
}: {
  contentId: string;
  currentStatus: string;
}) {
  const [, formAction, isPending] = useActionState(publishContent, initialState);
  const nextStatus = currentStatus === "published" ? "draft" : "published";

  return (
    <form action={formAction}>
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" variant="ghost" size="sm" isLoading={isPending}>
        {currentStatus === "published" ? "Despublicar" : "Publicar"}
      </Button>
    </form>
  );
}
