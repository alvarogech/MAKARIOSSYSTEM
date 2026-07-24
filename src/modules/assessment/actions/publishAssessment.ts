"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { publishAssessmentSchema } from "../schemas";

export interface PublishAssessmentState {
  error?: string;
  success?: boolean;
}

/**
 * Publica a avaliação — o momento em que o conjunto de elegíveis para o
 * gabarito é congelado (public.publish_assessment, SQL). A checagem de
 * permissão aqui é redundante com a que já existe dentro da função RPC,
 * de propósito (defesa em profundidade nas duas camadas).
 */
export async function publishAssessment(
  _prevState: PublishAssessmentState,
  formData: FormData,
): Promise<PublishAssessmentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "publish" })) {
    return { error: "Você não tem permissão para publicar avaliações." };
  }

  const parsed = publishAssessmentSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_assessment", {
    p_assessment_id: parsed.data.assessmentId,
  });

  if (error) {
    return { error: error.message || "Não foi possível publicar a avaliação." };
  }

  revalidatePath("/conteudo/avaliacoes");
  return { success: true };
}
