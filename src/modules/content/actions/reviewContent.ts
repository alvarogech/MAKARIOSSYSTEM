"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { isReviewAction, REVIEW_ACTION_RULES } from "../reviewWorkflow";

export interface ReviewContentState {
  error?: string;
  success?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Muda o estado editorial de questões ou desafios. Quem aprova/publica é
 * sempre quem está autenticado agora (o banco grava approved_by =
 * auth.uid(); nenhum campo vindo do formulário decide isso).
 */
export async function reviewContent(
  _prevState: ReviewContentState,
  formData: FormData,
): Promise<ReviewContentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "question_bank", action: "manage" })) {
    return { error: "Você não tem permissão para revisar conteúdo." };
  }

  const kind = formData.get("kind");
  const action = formData.get("action");
  const ids = formData.getAll("ids").map(String).filter((id) => UUID.test(id));

  if ((kind !== "question" && kind !== "challenge") || !isReviewAction(action) || ids.length === 0) {
    return { error: "Pedido inválido." };
  }

  const rule = REVIEW_ACTION_RULES[action];
  if (rule.challengeOnly && kind !== "challenge") {
    return { error: "Questões são publicadas através do exercício." };
  }
  if (rule.requiresApprover && !can(authContext, { resource: "question_bank", action: "approve" })) {
    return { error: "Apenas coordenação ou administração podem fazer isso." };
  }

  const supabase = await createSupabaseServerClient();
  const table = kind === "question" ? "question_bank" : "practice_challenges";

  const { data, error } = await supabase
    .from(table)
    .update({ status: rule.to })
    .in("id", ids)
    .in("status", rule.from)
    .select("id");

  if (error) {
    return { error: error.message.includes("Apenas") || error.message.includes("Só é possível") ? error.message : "Não foi possível atualizar." };
  }
  if (!data || data.length === 0) {
    return { error: "Nada foi alterado — os itens já não estavam no estado esperado. Atualize a página." };
  }

  revalidatePath("/conteudo/revisao");
  return { success: `${data.length} item(ns): ${rule.label.toLowerCase()}.` };
}

/** Publica (ou tira do ar) o exercício de fixação de uma matéria. */
export async function setActivityPublished(
  _prevState: ReviewContentState,
  formData: FormData,
): Promise<ReviewContentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "activities", action: "publish" })) {
    return { error: "Apenas coordenação ou administração podem publicar exercícios." };
  }

  const activityId = String(formData.get("activityId") ?? "");
  const mode = formData.get("mode");
  if (!UUID.test(activityId) || (mode !== "publish" && mode !== "unpublish")) {
    return { error: "Pedido inválido." };
  }

  const supabase = await createSupabaseServerClient();

  if (mode === "publish") {
    const { data: links } = await supabase
      .from("activity_questions")
      .select("question_id")
      .eq("activity_id", activityId);
    const questionIds = (links ?? []).map((l) => l.question_id);
    if (questionIds.length === 0) return { error: "Este exercício não tem questões." };

    const { data: questions } = await supabase.from("question_bank").select("status").in("id", questionIds);
    const pending = (questions ?? []).filter((q) => q.status !== "approved" && q.status !== "published").length;
    if (pending > 0) {
      return { error: `${pending} questão(ões) ainda não foram aprovadas — aprove todas antes de publicar.` };
    }
  }

  const { data, error } = await supabase
    .from("activities")
    .update({ status: mode === "publish" ? "published" : "draft" })
    .eq("id", activityId)
    .eq("status", mode === "publish" ? "draft" : "published")
    .select("id");

  if (error) return { error: "Não foi possível alterar o exercício." };
  if (!data || data.length === 0) return { error: "O exercício já não estava no estado esperado. Atualize a página." };

  revalidatePath("/conteudo/revisao");
  return { success: mode === "publish" ? "Exercício publicado para as turmas." : "Exercício retirado do ar." };
}
