"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createStudentOnboardingInvitation } from "../studentInvite";
import type { EnrollmentRequestStatus } from "../types";

export interface BulkReviewResult {
  error?: string;
  success?: boolean;
  warning?: string;
  updatedCount?: number;
}

const VALID_STATUSES: EnrollmentRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];
const MAX_BULK_SIZE = 500;

/**
 * Mesma regra do `reviewEnrollmentRequest` (aprovar dispara convite),
 * aplicada a várias inscrições de uma vez. Uma única instrução `update`
 * cobre todas as linhas (o gatilho de auditoria dispara uma vez por
 * linha automaticamente); os convites são enviados um a um só para quem
 * ainda não estava aprovado, para nunca reenviar convite a quem já tinha.
 */
export async function bulkReviewEnrollmentRequests(
  ids: string[],
  nextStatus: EnrollmentRequestStatus,
): Promise<BulkReviewResult> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return { error: "Você não tem permissão para revisar inscrições." };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "Nenhuma inscrição selecionada." };
  }
  if (ids.length > MAX_BULK_SIZE) {
    return { error: `Selecione no máximo ${MAX_BULK_SIZE} inscrições por vez.` };
  }
  if (!VALID_STATUSES.includes(nextStatus)) {
    return { error: "Status inválido." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: currentRows, error: fetchError } = await supabase
    .from("enrollment_requests")
    .select(
      "id, full_name, email, status, season_id, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug",
    )
    .in("id", ids);

  if (fetchError || !currentRows || currentRows.length === 0) {
    return { error: "Não foi possível carregar as inscrições selecionadas." };
  }

  const { error: updateError, count } = await supabase
    .from("enrollment_requests")
    .update(
      { status: nextStatus, reviewed_by: authContext.userId, reviewed_at: new Date().toISOString() },
      { count: "exact" },
    )
    .in(
      "id",
      currentRows.map((row) => row.id),
    );

  if (updateError) {
    return { error: "Não foi possível atualizar o status das inscrições selecionadas." };
  }

  await supabase.rpc("log_enrollment_admin_action", {
    p_action: "BULK_STATUS_CHANGE",
    p_entity_id: `${currentRows.length}_records`,
    p_new_value: { status: nextStatus, count: currentRows.length, ids: currentRows.map((row) => row.id) },
  });

  let warning: string | undefined;

  if (nextStatus === "approved") {
    const newlyApproved = currentRows.filter((row) => row.status !== "approved");
    if (newlyApproved.length > 0) {
      let failedInvites = 0;

      for (const row of newlyApproved) {
        const result = await createStudentOnboardingInvitation(supabase, row, authContext.userId);
        if (!result.ok) failedInvites += 1;
      }

      if (failedInvites > 0) {
        warning = `${failedInvites} de ${newlyApproved.length} convites não puderam ser enviados por e-mail.`;
      }
    }
  }

  revalidatePath("/coordenacao/inscricoes");
  return { success: true, warning, updatedCount: count ?? currentRows.length };
}
