import type { Metadata } from "next";
import { SetPasswordForm } from "@/modules/auth/components/SetPasswordForm";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function PrimeiroAcessoPage() {
  return (
    <SetPasswordForm
      title="Bem-vindo à Escola Makários"
      description="Você foi convidado para a Plataforma Makários. Crie sua senha para concluir o primeiro acesso."
      submitLabel="Criar senha e continuar"
      showTermsCheckbox
    />
  );
}
