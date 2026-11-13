"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { setLateRequestsWindowSchema } from "../schemas";
import { formatReleaseDeadline } from "../lateRelease";

export interface SetLateRequestsWindowState {
  error?: string;
  success?: string;
}

/** O campo da coordenação usa o horário de Brasília (sem horário de verão desde 2019). */
const BRASILIA_OFFSET = "-03:00";

/** Liga, muda ou desliga até quando a avaliação aceita pedido de liberação do aluno. */
export async function setLateRequestsWindow(
  _prevState: SetLateRequestsWindowState,
  formData: FormData,
): Promise<SetLateRequestsWindowState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "grant_exceptional_attempt" })) {
    return { error: "Você não tem permissão para mudar a janela de pedidos." };
  }

  const parsed = setLateRequestsWindowSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    intent: formData.get("intent"),
    until: formData.get("until") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  let until: string | null = null;
  if (parsed.data.intent === "save") {
    if (!parsed.data.until) return { error: "Escolha a data e a hora." };
    const date = new Date(`${parsed.data.until}:00${BRASILIA_OFFSET}`);
    if (Number.isNaN(date.getTime())) return { error: "Data inválida." };
    until = date.toISOString();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_late_requests_window", {
    p_assessment_id: parsed.data.assessmentId,
    p_until: until as string,
  });
  if (error) return { error: error.message || "Não foi possível mudar a janela de pedidos." };

  revalidatePath("/conteudo/avaliacoes");
  return {
    success: until ? `Pedidos de liberação abertos até ${formatReleaseDeadline(until)}.` : "Pedidos de liberação desligados.",
  };
}
