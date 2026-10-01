import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/serverEnv";
import { sendDueStudentOnboardingReminders } from "@/modules/enrollment/studentReminders";

/**
 * Chamada 1x/dia pelo pg_cron (via pg_net, com o header abaixo) — nunca
 * pelo navegador, não tem sessão de usuário. A lógica de "quem já recebeu
 * o quê" vive inteira em `sendDueStudentOnboardingReminders`; esta rota só
 * autentica a chamada e aciona.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== getCronSecret()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await sendDueStudentOnboardingReminders();
  return NextResponse.json(result);
}
