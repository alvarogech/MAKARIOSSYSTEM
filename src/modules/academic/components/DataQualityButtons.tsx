"use client";

import { useActionState } from "react";
import {
  cancelDuplicateAccountEnrollments,
  deleteDuplicateAccount,
  deleteEnrollmentRequest,
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

/** Exclui uma inscrição (só admin). O banco recusa quando não é seguro e a frase da trava aparece ao lado. */
export function DeleteRequestButton({ requestId, name }: { requestId: string; name: string }) {
  const [state, action, pending] = useActionState<DataQualityState, FormData>(deleteEnrollmentRequest, {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Excluir a inscrição de ${name}? Isso não pode ser desfeito (fica registrado na auditoria).`)) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" size="sm" variant="danger" isLoading={pending}>
        Excluir inscrição
      </Button>
      {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

/** Exclui uma conta duplicada que nunca foi usada (só admin; só quando o banco libera). */
export function DeleteAccountButton({ profileId, name }: { profileId: string; name: string }) {
  const [state, action, pending] = useActionState<DataQualityState, FormData>(deleteDuplicateAccount, {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Excluir esta conta duplicada de ${name}? Ela nunca foi usada. A outra conta com o mesmo e-mail continua valendo. Não pode ser desfeito.`)) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="profileId" value={profileId} />
      <Button type="submit" size="sm" variant="danger" isLoading={pending}>
        Excluir esta conta
      </Button>
      {state.success ? <span className="text-xs text-success">{state.success}</span> : null}
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
