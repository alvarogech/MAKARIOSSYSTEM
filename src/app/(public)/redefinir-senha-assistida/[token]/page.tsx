import type { Metadata } from "next";
import Link from "next/link";
import { inspectInviteToken } from "@/modules/auth/inspectInviteToken";
import { AssistedResetForm } from "@/modules/auth/components/AssistedResetForm";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Nova senha" };

const STATUS_MESSAGES: Record<string, string> = {
  not_found: "Este link não é válido. Peça um novo à coordenação.",
  revoked: "Este link foi revogado. Peça um novo à coordenação.",
  consumed: "Este link já foi utilizado. Se você já trocou sua senha, faça login normalmente.",
  expired: "Este link expirou (vale por 24 horas). Peça um novo à coordenação.",
  lookup_failed: "Não foi possível verificar o link agora. Atualize a página em alguns instantes.",
};

export default async function RedefinirSenhaAssistidaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await inspectInviteToken(token, "password_reset");

  if (info.status !== "valid") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Link indisponível</h1>
        <Alert variant="danger">{STATUS_MESSAGES[info.status]}</Alert>
        <p className="text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    );
  }

  return <AssistedResetForm token={token} />;
}
