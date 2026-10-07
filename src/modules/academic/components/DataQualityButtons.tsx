"use client";

import { useActionState } from "react";
import {
  cancelDuplicateAccountEnrollments,
  setDemoFlag,
  type DataQualityState,
} from "../actions/dataQuality";
import { Button } from "@/components/ui/Button";

export function DemoFlagButton({ profileId, value, label }: { profileId: string; value: boolean; label: string }) {
  const [state, action, pending] = useActionState<DataQualityState, FormData>(setDemoFlag, {});
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="value" value={value ? "1" : "0"} />
      <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
        {label}
      </Button>
      {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

export function CancelDuplicateButton({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState<DataQualityState, FormData>(cancelDuplicateAccountEnrollments, {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Cancelar as matrículas ativas desta conta? O histórico é mantido e a outra conta continua valendo.")) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="profileId" value={profileId} />
      <Button type="submit" size="sm" variant="secondary" isLoading={pending}>
        Cancelar matrícula desta conta
      </Button>
      {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
