"use client";

import { useActionState } from "react";
import {
  updatePendingTeacherContact,
  updateTeacherProfile,
  type UpdateTeacherProfileState,
} from "../actions/updateTeacherProfile";
import { Button } from "@/components/ui/Button";

const input =
  "h-10 w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

/** "Editar cadastro" (só administrador): nome e WhatsApp, de professor ativo ou de convite pendente. */
export function EditTeacherProfileForm({
  target,
  id,
  fullName,
  phone,
}: {
  target: "active" | "pending";
  id: string;
  fullName: string;
  phone: string | null;
}) {
  const [state, action, pending] = useActionState<UpdateTeacherProfileState, FormData>(
    target === "active" ? updateTeacherProfile : updatePendingTeacherContact,
    {},
  );
  const fieldId = `edit-${id}`;

  return (
    <details className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-brand-blue focus-visible:outline-2 focus-visible:outline-brand-blue">
        Editar cadastro
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t border-neutral-100 p-3">
        <input type="hidden" name={target === "active" ? "userId" : "invitationId"} value={id} />
        <div>
          <label htmlFor={`${fieldId}-nome`} className="mb-1 block text-xs font-medium text-neutral-600">
            Nome (como aparece na escala)
          </label>
          <input id={`${fieldId}-nome`} name="fullName" defaultValue={fullName} required minLength={2} maxLength={120} className={input} />
        </div>
        <div>
          <label htmlFor={`${fieldId}-tel`} className="mb-1 block text-xs font-medium text-neutral-600">
            WhatsApp (DDD + número)
          </label>
          <input id={`${fieldId}-tel`} name="phone" defaultValue={phone ?? ""} inputMode="tel" placeholder="(62) 99999-9999" className={input} />
        </div>
        <p className="text-xs text-neutral-500">O e-mail de login não muda aqui.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" isLoading={pending}>
            Salvar
          </Button>
          <span aria-live="polite" className="text-xs">
            {state.error ? <span className="text-danger">{state.error}</span> : null}
            {state.success ? <span className="text-success">{state.success}</span> : null}
          </span>
        </div>
      </form>
    </details>
  );
}
