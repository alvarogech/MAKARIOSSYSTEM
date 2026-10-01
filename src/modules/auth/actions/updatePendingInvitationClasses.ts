"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { resolveClassIdsForBlocks } from "../manualInvite";

export interface UpdatePendingInvitationClassesState {
  error?: string;
  success?: boolean;
}

/**
 * "Editar aulas" de um convite manual AINDA pendente — atualiza
 * meeting_block_ids (e class_ids, derivado) na própria linha, sem mexer no
 * token. Quando o professor aceitar, teacher_assignments e
 * class_meeting_blocks.teacher_id são preenchidos a partir do valor que
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

  const meetingBlockIds = formData.getAll("meetingBlockIds").map(String).filter(Boolean);
  const supabase = await createSupabaseServerClient();
  const classIds = await resolveClassIdsForBlocks(supabase, meetingBlockIds);

  const { error, data } = await supabase
    .from("invitations")
    .update({ class_ids: classIds, meeting_block_ids: meetingBlockIds })
    .eq("id", invitationId)
    .eq("channel", "manual_link")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Não foi possível atualizar as aulas vinculadas." };
  }

  if (!data) {
    return { error: "Este convite não está mais pendente (já foi usado, revogado ou expirou)." };
  }

  revalidatePath("/coordenacao/professores");
  return { success: true };
}
