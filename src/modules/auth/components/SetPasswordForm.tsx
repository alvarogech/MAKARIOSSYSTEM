"use client";

import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "../actions/updatePassword";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Alert } from "@/components/ui/Alert";

const initialState: UpdatePasswordState = {};

export function SetPasswordForm({
  title,
  description,
  submitLabel,
  showTermsCheckbox,
}: {
  title: string;
  description: string;
  submitLabel: string;
  showTermsCheckbox: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updatePassword,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div>
        <Label htmlFor="password">Nova senha</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
        />
        <p className="mt-1 text-xs text-neutral-500">
          Mínimo 8 caracteres, com letra maiúscula, minúscula e número.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </div>

      {showTermsCheckbox ? (
        <label className="flex items-start gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            name="acceptedTerms"
            className="mt-0.5 size-4 rounded border-neutral-300 text-brand-blue focus:ring-brand-blue"
            required
          />
          <span>
            Li e aceito os termos de uso e a política de privacidade da
            Plataforma Makários.
          </span>
        </label>
      ) : (
        <input type="hidden" name="acceptedTerms" value="on" />
      )}

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
