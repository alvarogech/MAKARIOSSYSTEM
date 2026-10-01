"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";

export interface UpdatePendingInvitationClassesState {
  error?: string;
  success?: boolean;
}

/**
 * "Editar vínculos com turmas" para um convite manual AINDA pendente — só
 * atualiza class_ids na própria linha, sem mexer no token. Quando o
 * professor aceitar, teacher_assignments é criado a partir do valor que
 * estiver aqui NAQUELE momento (não do que estava no instante do convite).
 */
export async function updatePendingInvitationClasses(
  _prevState: UpdatePendingInvitationClassesState,
  formData: FormData,
): Promise<UpdatePendingInvitationClassesState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "teacher_provisioning", action: "manage" })
  ) {
    return { error: "Você não tem permissão para editar este convite." };
  }

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) {
    return { error: "Convite inválido." };
  }

  const classIds = formData.getAll("classIds").map(String).filter(Boolean);
  const supabase = await createSupabaseServerClient();

  const { error, data } = await supabase
    .from("invitations")
    .update({ class_ids: classIds })
    .eq("id", invitationId)
    .eq("channel", "manual_link")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Não foi possível atualizar as turmas vinculadas." };
  }

  if (!data) {
    return { error: "Este convite não está mais pendente (já foi usado, revogado ou expirou)." };
  }

  revalidatePath("/coordenacao/professores");
  return { success: true };
}
