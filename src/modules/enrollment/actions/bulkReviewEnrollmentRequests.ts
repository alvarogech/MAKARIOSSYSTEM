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
 * aplicada a várias inscrições de uma vez.
 *
 * Para "approved" especificamente, o status e o e-mail de CADA linha são
 * gravados juntos, uma linha por vez — de propósito, não como um único
 * `update` em massa seguido de um loop de envio. Um lote grande (100+)
 * pode levar minutos para mandar todos os e-mails; se a função atingir o
 * tempo limite do servidor no meio do caminho, só queremos que fiquem
 * "approved" as linhas que JÁ têm convite/e-mail disparado — as demais
 * continuam "pending" e uma nova tentativa (selecionar "pending" de novo e
 * aprovar) retoma exatamente de onde parou, sem duplicar e-mail de quem já
 * recebeu. Para os outros status (sem e-mail envolvido), o update em massa
 * de antes continua valendo — é rápido e não tem esse risco.
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

  if (nextStatus !== "approved") {
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

    revalidatePath("/coordenacao/inscricoes");
    return { success: true, updatedCount: count ?? currentRows.length };
  }

  const nowIso = new Date().toISOString();
  const newlyApproved = currentRows.filter((row) => row.status !== "approved");
  const alreadyApproved = currentRows.length - newlyApproved.length;
  let approvedCount = alreadyApproved;
  // E-mail(is) que falharam DEPOIS do status já ter virado "approved" —
  // reaprovar não vai re-disparar o convite (já não está mais "pending"),
  // então é isso, nominalmente, que a coordenação precisa resolver à mão.
  const failedEmails: string[] = [];

  for (const row of newlyApproved) {
    const { error: rowUpdateError } = await supabase
      .from("enrollment_requests")
      .update({ status: "approved", reviewed_by: authContext.userId, reviewed_at: nowIso })
      .eq("id", row.id);

    if (rowUpdateError) {
      continue; // status nem mudou — continua "pending", uma nova tentativa resolve sozinha
    }

    approvedCount += 1;

    await supabase.rpc("log_enrollment_admin_action", {
      p_action: "STATUS_CHANGE",
      p_entity_id: row.id,
      p_new_value: { status: "approved" },
    });

    const result = await createStudentOnboardingInvitation(supabase, row, authContext.userId);
    if (!result.ok) failedEmails.push(`${row.full_name} <${row.email}>`);
  }

  let warning: string | undefined;
  if (failedEmails.length > 0) {
    warning =
      `Aprovadas, mas o e-mail de acesso não pôde ser enviado para: ${failedEmails.join(", ")}. ` +
      "Confira o e-mail cadastrado e gere o acesso manualmente para essas pessoas.";
  }

  revalidatePath("/coordenacao/inscricoes");
  return { success: true, warning, updatedCount: approvedCount };
}
