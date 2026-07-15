import { Ban } from "lucide-react";
import { signOut } from "@/modules/auth/actions/signOut";
import { Button } from "@/components/ui/Button";

export function SuspendedAccount() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Ban className="size-12 text-danger" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-neutral-900">
        Sua conta está suspensa
      </h1>
      <p className="max-w-sm text-sm text-neutral-500">
        O acesso a esta conta foi temporariamente suspenso pela
        administração da Escola Makários. Entre em contato com a
        coordenação para regularizar sua situação.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sair
        </Button>
      </form>
    </div>
  );
}
