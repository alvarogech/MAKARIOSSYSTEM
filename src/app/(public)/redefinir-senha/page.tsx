import type { Metadata } from "next";
import { SetPasswordForm } from "@/modules/auth/components/SetPasswordForm";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function RedefinirSenhaPage() {
  return (
    <SetPasswordForm
      title="Redefinir senha"
      description="Crie uma nova senha para sua conta na Plataforma Makários."
      submitLabel="Salvar nova senha"
      showTermsCheckbox={false}
    />
  );
}
