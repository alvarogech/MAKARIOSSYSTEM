import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/serverEnv";
import { resendStudentOnboardingInvite } from "@/modules/enrollment/studentReminders";

/**
 * Força o reenvio do convite de primeiro acesso de UM aluno (link novo,
 * e-mail novo) — uso manual/pontual pela coordenação quando o link
 * original não funciona por algum motivo fora do nosso controle (ex.:
 * cliente de e-mail do aluno corrompeu a URL). Mesma autenticação por
 * segredo compartilhado da rota de lembretes; nunca chamada pelo
 * navegador do aluno.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== getCronSecret()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const invitationId = body?.invitationId;
  if (typeof invitationId !== "string" || invitationId.length === 0) {
    return NextResponse.json({ error: "invitationId é obrigatório." }, { status: 400 });
  }

  const result = await resendStudentOnboardingInvite(invitationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
