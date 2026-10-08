"use client";

import { useActionState } from "react";
import { changeTeacherLoginEmail, type ChangeTeacherEmailState } from "../actions/changeTeacherEmail";
import { Button } from "@/components/ui/Button";

const input =
  "h-10 w-full rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue";

function Feedback({ state }: { state: ChangeTeacherEmailState }) {
  return (
    <span aria-live="polite" className="text-xs">
      {state.error ? <span className="text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-success">{state.success}</span> : null}
    </span>
  );
}

/** "Trocar e-mail de login" (só administrador): digita o novo e-mail do professor ativo. A senha não muda. */
export function ChangeTeacherEmailForm({ userId, currentEmail, name }: { userId: string; currentEmail: string | null; name: string }) {
  const [state, action, pending] = useActionState<ChangeTeacherEmailState, FormData>(changeTeacherLoginEmail, {});
  const fieldId = `email-${userId}`;
  return (
    <details className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-brand-blue focus-visible:outline-2 focus-visible:outline-brand-blue">
        Trocar e-mail de login
      </summary>
      <form
        action={action}
        onSubmit={(event) => {
          const next = String(new FormData(event.currentTarget).get("email") ?? "").trim();
          if (!window.confirm(`Trocar o e-mail de login de ${name} para ${next}? Ela(e) passa a entrar com o novo e-mail; a senha continua a mesma.`)) {
            event.preventDefault();
          }
        }}
        className="flex flex-col gap-3 border-t border-neutral-100 p-3"
      >
        <input type="hidden" name="userId" value={userId} />
        <div>
          <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-neutral-600">
            Novo e-mail
          </label>
          <input id={fieldId} name="email" type="email" required placeholder="nome@exemplo.com" autoComplete="off" className={input} />
          {currentEmail ? <p className="mt-1 text-xs text-neutral-500">Hoje: {currentEmail}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" isLoading={pending}>
            Trocar e-mail
          </Button>
          <Feedback state={state} />
        </div>
      </form>
    </details>
  );
}

/** Atalho do convite repetido: o e-mail do convite vira o e-mail de login do professor que já está ativo (e o convite é revogado). */
export function UseInviteEmailButton({
  userId,
  invitationId,
  email,
  name,
}: {
  userId: string;
  invitationId: string;
  email: string;
  name: string;
}) {
  const [state, action, pending] = useActionState<ChangeTeacherEmailState, FormData>(changeTeacherLoginEmail, {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Passar o login de ${name} para ${email}? O convite pendente será revogado e a senha continua a mesma.`)) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <input type="hidden" name="email" value={email} />
      <Button type="submit" size="sm" isLoading={pending}>
        Usar este e-mail no acesso de {name}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
