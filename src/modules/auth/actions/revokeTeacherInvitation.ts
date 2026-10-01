"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";

export interface RevokeTeacherInvitationState {
  error?: string;
  success?: boolean;
}

export async function revokeTeacherInvitation(
  _prevState: RevokeTeacherInvitationState,
  formData: FormData,
): Promise<RevokeTeacherInvitationState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "teacher_provisioning", action: "manage" })
  ) {
    return { error: "Você não tem permissão para revogar convites." };
  }

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) {
    return { error: "Convite inválido." };
  }

  const supabase = await createSupabaseServerClient();

  // Idempotente: só afeta a linha se ainda estiver pendente (não consumida,
  // ainda não revogada) — revogar duas vezes ou revogar algo já aceito não
  // faz nada, não é erro.
  const { error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString(), revoked_by: authContext.userId })
    .eq("id", invitationId)
    .eq("channel", "manual_link")
    .is("consumed_at", null)
    .is("revoked_at", null);

  if (error) {
    return { error: "Não foi possível revogar o convite." };
  }

  revalidatePath("/coordenacao/professores");
  return { success: true };
}
