"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createManualTeacherInvitationRow } from "../manualInvite";

export interface RegenerateTeacherInvitationState {
  error?: string;
  result?: { link: string; whatsappMessage: string };
}

/**
 * "Gerar novo convite, invalidando o anterior" — revoga a linha antiga e
 * cria uma nova com token fresco, reaproveitando nome/telefone/turmas já
 * cadastrados (a coordenação não precisa digitar tudo de novo).
 */
export async function regenerateTeacherInvitation(
  _prevState: RegenerateTeacherInvitationState,
  formData: FormData,
): Promise<RegenerateTeacherInvitationState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "teacher_provisioning", action: "manage" })
  ) {
    return { error: "Você não tem permissão para gerar convites." };
  }

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) {
    return { error: "Convite inválido." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: old } = await supabase
    .from("invitations")
    .select("email, intended_full_name, phone, class_ids, meeting_block_ids, intended_role_id, consumed_at")
    .eq("id", invitationId)
    .eq("channel", "manual_link")
    .eq("purpose", "teacher_onboarding")
    .maybeSingle();

  if (!old) {
    return { error: "Convite não encontrado." };
  }

  if (old.consumed_at) {
    return { error: "Este convite já foi utilizado — não há o que regenerar." };
  }

  const { error: revokeError } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString(), revoked_by: authContext.userId })
    .eq("id", invitationId)
    .is("consumed_at", null);

  if (revokeError) {
    return { error: "Não foi possível invalidar o convite anterior." };
  }

  const created = await createManualTeacherInvitationRow(supabase, {
    email: old.email,
    fullName: old.intended_full_name ?? "Professor(a)",
    phone: old.phone ?? "",
    classIds: old.class_ids ?? [],
    meetingBlockIds: old.meeting_block_ids ?? [],
    invitedBy: authContext.userId,
    teacherRoleId: old.intended_role_id,
  });

  if ("dbError" in created) {
    return { error: "O convite anterior foi revogado, mas o novo não pôde ser criado." };
  }

  revalidatePath("/coordenacao/professores");
  return { result: created };
}
