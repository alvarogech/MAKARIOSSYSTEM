"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { canAccessArea, getAuthContext } from "@/authorization";
import { checkRateLimit } from "@/modules/auth/rateLimit";
import { requestLateReleaseSchema } from "../schemas";

export interface RequestLateReleaseState {
  error?: string;
}

const GENERIC_ERROR = "Não foi possível liberar a prova agora. Tente de novo em instantes.";

/**
 * O próprio aluno pede a liberação da prova depois do prazo, escrevendo o motivo.
 * A identidade vem da sessão (nada de nome, CPF ou e-mail digitado). Toda conferência e a gravação
 * acontecem na função `request_late_release` do banco (security definer): o aluno nunca grava
 * direto na tabela. Dá certo, vai direto para a preparação da prova.
 */
export async function requestLateRelease(
  _prevState: RequestLateReleaseState,
  formData: FormData,
): Promise<RequestLateReleaseState> {
  const authContext = await getAuthContext();
  if (!authContext || !canAccessArea(authContext, "student")) {
    return { error: "Entre como aluno para pedir a liberação da prova." };
  }

  const parsed = requestLateReleaseSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createSupabaseServerClient();

  const allowed = await checkRateLimit(supabase, `late-release:${authContext.userId}`, 5, 600);
  if (!allowed) return { error: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo." };

  const { error } = await supabase.rpc("request_late_release", {
    p_assessment_id: parsed.data.assessmentId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    // Erros de regra vêm do banco em português (P0001); qualquer outro é falha técnica.
    return { error: error.code === "P0001" && error.message ? error.message : GENERIC_ERROR };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/avaliacoes/${parsed.data.assessmentId}`);
  redirect(`/avaliacoes/${parsed.data.assessmentId}`);
}
