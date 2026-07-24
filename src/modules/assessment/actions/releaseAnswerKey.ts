"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { publishAssessmentSchema as assessmentIdSchema } from "../schemas";

export interface ReleaseAnswerKeyState {
  error?: string;
  success?: boolean;
}

export async function releaseAnswerKey(
  _prevState: ReleaseAnswerKeyState,
  formData: FormData,
): Promise<ReleaseAnswerKeyState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "assessments", action: "release_answer_key" })) {
    return { error: "Você não tem permissão para liberar o gabarito." };
  }

  const parsed = assessmentIdSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("release_answer_key_manually", {
    p_assessment_id: parsed.data.assessmentId,
  });

  if (error) {
    return { error: error.message || "Não foi possível liberar o gabarito." };
  }

  revalidatePath("/conteudo/avaliacoes");
  return { success: true };
}
