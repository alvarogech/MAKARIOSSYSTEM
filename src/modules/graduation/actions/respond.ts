"use server";

import { revalidatePath } from "next/cache";
import { canAccessArea, getAuthContext } from "@/authorization";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { UUID, type GraduationState } from "../guard";

/**
 * O aluno responde ao convite. A função do banco confere dono, convite, publicação
 * e prazo, e responder de novo atualiza a mesma linha (sem duplicar). Nenhum dado
 * acadêmico é tocado por aqui.
 */
export async function respondToInvitation(_prev: GraduationState, formData: FormData): Promise<GraduationState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Sessão expirada. Entre de novo." };
  if (!canAccessArea(auth, "student")) return { error: "Esta área é exclusiva do perfil Aluno." };

  const editionId = String(formData.get("editionId") ?? "");
  const response = String(formData.get("response") ?? "");
  if (!UUID.test(editionId)) return { error: "Convite inválido." };
  if (response !== "confirmado" && response !== "nao_comparece") return { error: "Escolha uma das opções." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("graduation_respond", { p_edition_id: editionId, p_response: response });
  if (error) return { error: error.message };

  revalidatePath("/formatura");
  revalidatePath("/dashboard");
  revalidatePath("/coordenacao/formatura", "layout");
  return { success: response === "confirmado" ? "Presença confirmada. Obrigado!" : "Resposta registrada. Sentiremos sua falta." };
}
