import type { Metadata } from "next";
import Link from "next/link";
import { inspectInviteToken } from "@/modules/auth/inspectInviteToken";
import { TeacherOnboardingForm } from "@/modules/auth/components/TeacherOnboardingForm";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Convite — Professor" };

const STATUS_MESSAGES: Record<string, string> = {
  not_found: "Este link não é válido. Confira se copiou o endereço completo ou peça um novo convite à coordenação.",
  revoked: "Este convite foi revogado pela coordenação. Peça um novo link.",
  consumed: "Este convite já foi utilizado. Se você já concluiu seu cadastro, faça login normalmente.",
  expired: "Este convite expirou (os links valem por 7 dias). Peça um novo à coordenação.",
  lookup_failed: "Não foi possível verificar o convite agora. Atualize a página em alguns instantes.",
};

export default async function ConviteProfessorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await inspectInviteToken(token, "manual_link", "teacher_onboarding");

  if (info.status !== "valid") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Convite indisponível</h1>
        <Alert variant="danger">{STATUS_MESSAGES[info.status]}</Alert>
        <p className="text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <TeacherOnboardingForm
      token={token}
      defaultFullName={info.fullName ?? ""}
      defaultPhone={info.phone ?? ""}
      email={info.email ?? ""}
      hasAccount={info.hasAccount ?? false}
    />
  );
}
