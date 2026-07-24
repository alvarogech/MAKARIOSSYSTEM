"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createAssessmentSchema } from "../schemas";

export interface CreateAssessmentState {
  error?: string;
  success?: boolean;
}

/**
 * Cria a avaliação em rascunho (status = draft). Números padrão vêm do
 * doc 02/08 (20 questões, 60 minutos, 14 dias, nota mínima 6) — quem
 * cria pode ajustar, mas nunca some sem valor.
 */
export async function createAssessment(
  _prevState: CreateAssessmentState,
  formData: FormData,
): Promise<CreateAssessmentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "manage" })) {
    return { error: "Você não tem permissão para criar avaliações." };
  }

  const parsed = createAssessmentSchema.safeParse({
    seasonVolumeOfferingId: formData.get("seasonVolumeOfferingId"),
    type: formData.get("type"),
    linkedAssessmentId: formData.get("linkedAssessmentId") || undefined,
    title: formData.get("title"),
    questionsCount: formData.get("questionsCount") || undefined,
    durationMinutes: formData.get("durationMinutes") || undefined,
    opensAt: formData.get("opensAt") || undefined,
    windowDays: formData.get("windowDays") || undefined,
    passingGrade: formData.get("passingGrade") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const opensAt = parsed.data.opensAt ? new Date(parsed.data.opensAt) : null;
  const closesAt = opensAt
    ? new Date(opensAt.getTime() + parsed.data.windowDays * 24 * 60 * 60 * 1000)
    : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assessments").insert({
    season_volume_offering_id: parsed.data.seasonVolumeOfferingId,
    type: parsed.data.type,
    linked_assessment_id: parsed.data.linkedAssessmentId || null,
    title: parsed.data.title,
    questions_count: parsed.data.questionsCount,
    duration_minutes: parsed.data.durationMinutes,
    opens_at: opensAt?.toISOString() ?? null,
    closes_at: closesAt?.toISOString() ?? null,
    passing_grade: parsed.data.passingGrade,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Esta oferta já tem uma avaliação deste tipo."
        : "Não foi possível criar a avaliação.",
    };
  }

  revalidatePath("/conteudo/avaliacoes");
  return { success: true };
}
