"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createStudentOnboardingInvitation } from "../studentInvite";
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
    .select(
      "id, full_name, email, status, season_id, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug",
    )
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
    const result = await createStudentOnboardingInvitation(supabase, current, authContext.userId);
    if (!result.ok) {
      warning = `A inscrição foi aprovada, mas o convite por e-mail não pôde ser enviado: ${result.error}`;
    }
  }

  revalidatePath("/coordenacao/inscricoes");
  return { success: true, warning };
}
