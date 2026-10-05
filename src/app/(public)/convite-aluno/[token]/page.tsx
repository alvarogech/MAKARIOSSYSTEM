import type { Metadata } from "next";
import Link from "next/link";
import { inspectInviteToken } from "@/modules/auth/inspectInviteToken";
import { StudentOnboardingForm } from "@/modules/enrollment/components/StudentOnboardingForm";
import { RequestStudentInviteLinkForm } from "@/modules/enrollment/components/RequestStudentInviteLinkForm";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Convite — Aluno" };

const STATUS_MESSAGES: Record<string, string> = {
  not_found: "Este link não é válido. Isso pode acontecer se você abriu um e-mail antigo. Peça um novo link abaixo.",
  revoked: "Este convite foi revogado pela coordenação. Peça um novo link.",
  consumed: "Este convite já foi utilizado. Se você já concluiu seu cadastro, faça login normalmente.",
  expired: "Este convite expirou. Peça um novo link abaixo.",
  lookup_failed: "Não foi possível verificar o convite agora. Atualize a página em alguns instantes.",
};

export default async function ConviteAlunoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await inspectInviteToken(token, "email", "student_onboarding");

  if (info.status !== "valid") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Convite indisponível</h1>
        <Alert variant="danger">{STATUS_MESSAGES[info.status]}</Alert>
        {info.status === "not_found" || info.status === "expired" ? <RequestStudentInviteLinkForm /> : null}
        <p className="text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <StudentOnboardingForm
      token={token}
      defaultFullName={info.fullName ?? ""}
      email={info.email ?? ""}
      useAccessCode={info.useAccessCode ?? false}
    />
  );
}
