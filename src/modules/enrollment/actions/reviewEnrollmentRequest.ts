"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { can, getAuthContext } from "@/authorization";
import type { EnrollmentRequestStatus } from "../types";

export interface ReviewEnrollmentRequestState {
  error?: string;
  success?: boolean;
  warning?: string;
}

const VALID_STATUSES: EnrollmentRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];

/**
 * Muda o status de uma solicitação de inscrição (Coordenação > Inscrições).
 * Aprovar dispara o convite por e-mail (perfil Aluno) — o mesmo mecanismo
 * de `createInvitation`, reaproveitado aqui. A matrícula em si e uma
 * eventual exceção de pré-requisito continuam sendo passos manuais
 * posteriores, feitos pela coordenação em Matrículas, depois que a pessoa
 * aceitar o convite (doc combinado ao desenhar esta tela).
 */
export async function reviewEnrollmentRequest(
  _prevState: ReviewEnrollmentRequestState,
  formData: FormData,
): Promise<ReviewEnrollmentRequestState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return { error: "Você não tem permissão para revisar inscrições." };
  }

  const requestId = formData.get("requestId");
  const nextStatus = formData.get("status");

  if (
    typeof requestId !== "string" ||
    typeof nextStatus !== "string" ||
    !VALID_STATUSES.includes(nextStatus as EnrollmentRequestStatus)
  ) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: current, error: fetchError } = await supabase
    .from("enrollment_requests")
    .select("id, full_name, email, status")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError || !current) {
    return { error: "Inscrição não encontrada." };
  }

  const alreadyApproved = current.status === "approved";

  const { error: updateError } = await supabase
    .from("enrollment_requests")
    .update({
      status: nextStatus,
      reviewed_by: authContext.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    return { error: "Não foi possível atualizar o status da inscrição." };
  }

  let warning: string | undefined;

  if (nextStatus === "approved" && !alreadyApproved) {
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("slug", "student")
      .single();

    if (!role) {
      warning = "A inscrição foi aprovada, mas o perfil Aluno não foi encontrado para enviar o convite.";
    } else {
      await supabase.from("invitations").insert({
        email: current.email,
        intended_role_id: role.id,
        invited_by: authContext.userId,
      });

      const admin = createSupabaseAdminClient();
      const { error: inviteEmailError } = await admin.auth.admin.inviteUserByEmail(current.email, {
        data: { full_name: current.full_name },
      });

      if (inviteEmailError) {
        warning = `A inscrição foi aprovada, mas o convite por e-mail não pôde ser enviado: ${inviteEmailError.message}`;
      }
    }
  }

  revalidatePath("/coordenacao/inscricoes");
  return { success: true, warning };
}
