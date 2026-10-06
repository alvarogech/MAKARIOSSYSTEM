"use client";

import { startTransition, useActionState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  requestAccessRescue,
  type RequestAccessRescueState,
  type RescueOutcome,
} from "../actions/requestAccessRescue";

const initialState: RequestAccessRescueState = {};

const SPAM_HINT = "Confira também a caixa de spam/lixo eletrônico e a aba Promoções. O e-mail costuma chegar em poucos minutos.";

function Outcome({ outcome, maskedEmail }: { outcome: RescueOutcome; maskedEmail?: string }) {
  const where = maskedEmail ? `para o e-mail da sua inscrição (${maskedEmail})` : "para o e-mail da sua inscrição";

  switch (outcome) {
    case "invite_sent":
      return (
        <Alert variant="success">
          Enviamos um novo link de primeiro acesso {where}. Abra o <strong>e-mail mais recente</strong> e crie sua senha.{" "}
          {SPAM_HINT}
        </Alert>
      );
    case "reset_sent":
      return (
        <Alert variant="success">
          Você já tem conta! Enviamos {where} um link para criar uma nova senha — depois é só entrar em{" "}
          <Link href="/login" className="font-medium underline">
            Entrar
          </Link>{" "}
          com esse e-mail. {SPAM_HINT}
        </Alert>
      );
    case "in_review":
      return (
        <Alert variant="warning">
          Sua inscrição foi recebida, mas ainda está em análise pela coordenação. Assim que for aprovada, você recebe o
          link de acesso por e-mail.
        </Alert>
      );
    case "email_failed":
      return (
        <Alert variant="danger">
          Encontramos sua inscrição, mas não conseguimos enviar o e-mail agora (o limite diário de envios pode ter sido
          atingido). Tente novamente amanhã ou fale com a coordenação.
        </Alert>
      );
    case "contact_coordination":
      return (
        <Alert variant="warning">
          Encontramos sua inscrição, mas o acesso precisa ser liberado manualmente. Fale com a coordenação informando seu
          nome completo.
        </Alert>
      );
  }
}

export function AccessRescueForm() {
  const [state, formAction, isPending] = useActionState(requestAccessRescue, initialState);
  // Antes de o JavaScript carregar, um envio cairia no GET nativo do navegador e
  // colocaria o CPF/e-mail na barra de endereço. O botão só liga depois da hidratação.
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Recuperar meu acesso</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Não conseguiu abrir o link que veio no e-mail, ou ele expirou? Informe o <strong>e-mail</strong> ou o{" "}
          <strong>CPF</strong> que você usou na inscrição e enviamos um novo link para o e-mail cadastrado nela.
        </p>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div>
        <Label htmlFor="identifier">E-mail ou CPF da inscrição</Label>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="off"
          inputMode="email"
          placeholder="nome@email.com ou 000.000.000-00"
          required
        />
      </div>

      <Button type="submit" isLoading={isPending} disabled={!isReady} className="w-full">
        Enviar novo link de acesso
      </Button>

      {state.result?.found
        ? state.result.outcomes.map((outcome) => (
            <Outcome key={outcome} outcome={outcome} maskedEmail={state.result?.maskedEmail} />
          ))
        : null}

      {state.result && !state.result.found ? (
        <Alert variant="warning">
          Não encontramos uma inscrição com esse dado. Confira se digitou exatamente como na inscrição — se você usou
          outro e-mail, tente com o <strong>CPF</strong>. Se mesmo assim não achar, fale com a coordenação informando seu
          nome completo e CPF.
        </Alert>
      ) : null}

      <p className="text-center text-xs text-neutral-500">
        Já tem senha?{" "}
        <Link href="/login" className="font-medium text-brand-blue hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
