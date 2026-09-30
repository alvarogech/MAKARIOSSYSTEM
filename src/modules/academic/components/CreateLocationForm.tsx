"use client";

import { useActionState } from "react";
import { createLocation, type CreateLocationState } from "../actions/createLocation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";

const initialState: CreateLocationState = {};

export function CreateLocationForm() {
  const [state, formAction, isPending] = useActionState(createLocation, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">Local cadastrado.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Nome do local</Label>
          <Input id="name" name="name" required placeholder="Ex.: Sede Igreja Emaús" />
        </div>
        <div>
          <Label htmlFor="address">Endereço completo</Label>
          <Input id="address" name="address" placeholder="Rua, número, bairro, cidade" />
        </div>
        <div>
          <Label htmlFor="entryInstructions">Orientações de entrada</Label>
          <Input id="entryInstructions" name="entryInstructions" placeholder="Ex.: Portão lateral, sala 3" />
        </div>
        <div>
          <Label htmlFor="parkingInstructions">Estacionamento</Label>
          <Input id="parkingInstructions" name="parkingInstructions" placeholder="Ex.: Pátio interno, gratuito" />
        </div>
        <div>
          <Label htmlFor="arrivalMinutesBefore">Chegar com quantos minutos de antecedência?</Label>
          <Input id="arrivalMinutesBefore" name="arrivalMinutesBefore" type="number" min={1} />
        </div>
        <div>
          <Label htmlFor="coordinationContact">Contato da coordenação</Label>
          <Input id="coordinationContact" name="coordinationContact" placeholder="Telefone, WhatsApp ou e-mail" />
        </div>
      </div>

      <Button type="submit" isLoading={isPending} className="self-start">
        Cadastrar local
      </Button>
    </form>
  );
}
