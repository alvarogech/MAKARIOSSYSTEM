import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { SetPasswordForm } from "@/modules/auth/components/SetPasswordForm";
import { AccessRescueForm } from "@/modules/enrollment/components/AccessRescueForm";

export const metadata: Metadata = { title: "Primeiro acesso" };

/**
 * Esta página tem dois públicos:
 * - quem chega pelo link do e-mail de convite (via /api/auth/callback), que já
 *   vem com sessão aberta e só precisa criar a senha;
 * - quem chega pelo "Complete seu primeiro acesso" da tela de login, ou por um
 *   link antigo, sem sessão. Antes essa pessoa via o formulário de senha e só
 *   descobria o erro ("Sessão expirada ou link inválido") depois de preencher.
 *   Agora ela informa o e-mail ou o CPF da inscrição e recebe o link de novo,
 *   sempre no e-mail cadastrado na inscrição.
 */
export default async function PrimeiroAcessoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AccessRescueForm
        title="Primeiro acesso"
        description={
          <>
            Para criar sua senha, você precisa do link do seu convite. Informe o <strong>e-mail</strong> ou o{" "}
            <strong>CPF</strong> que você usou na inscrição e enviamos o link para o e-mail cadastrado nela.
          </>
        }
      />
    );
  }

  return (
    <SetPasswordForm
      title="Bem-vindo à Escola Makários"
      description="Você foi convidado para a Plataforma Makários. Crie sua senha para concluir o primeiro acesso."
      submitLabel="Criar senha e continuar"
      showTermsCheckbox
    />
  );
}
