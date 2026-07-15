"use client";

import { useActionState } from "react";
import { setActiveRole, type SetActiveRoleState } from "../actions/setActiveRole";
import type { RoleSlug } from "@/authorization";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roleLabels";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const initialState: SetActiveRoleState = {};

export function SelectRoleForm({ roles }: { roles: RoleSlug[] }) {
  const [state, formAction, isPending] = useActionState(
    setActiveRole,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Escolha como deseja entrar
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sua conta tem mais de um perfil na Escola Makários. Selecione com
          qual perfil você quer navegar agora — você pode trocar depois.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <form action={formAction} key={role}>
            <input type="hidden" name="roleSlug" value={role} />
            <Button
              type="submit"
              variant="secondary"
              isLoading={isPending}
              className="w-full justify-start text-left"
            >
              <span className="flex flex-col items-start">
                <span className="font-semibold">{ROLE_LABELS[role]}</span>
                <span className="text-xs font-normal text-neutral-500">
                  {ROLE_DESCRIPTIONS[role]}
                </span>
              </span>
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
