"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { createPrerequisiteExceptionSchema } from "../schemas";

export interface CreatePrerequisiteExceptionState {
  error?: string;
  success?: boolean;
}

/**
 * Autoriza uma exceção individual de pré-requisito, sempre com
 * justificativa e sempre auditada (trigger em
 * prerequisite_exceptions — ver migration 00000000000014). Depois de
 * criada, uma nova tentativa de matrícula (createEnrollment) passa a
 * considerar esse pré-requisito específico como satisfeito.
 */
export async function createPrerequisiteException(
  _prevState: CreatePrerequisiteExceptionState,
  formData: FormData,
): Promise<CreatePrerequisiteExceptionState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "prerequisite_exceptions", action: "create" })
  ) {
    return { error: "Você não tem permissão para autorizar exceções." };
  }

  const parsed = createPrerequisiteExceptionSchema.safeParse({
    studentEmail: formData.get("studentEmail"),
    volumeId: formData.get("volumeId"),
    missingPrerequisiteVolumeId: formData.get("missingPrerequisiteVolumeId"),
    justification: formData.get("justification"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.studentEmail)
    .maybeSingle();

  if (!studentProfile) {
    return { error: "Aluno não encontrado com esse e-mail." };
  }

  const { error } = await supabase.from("prerequisite_exceptions").insert({
    student_id: studentProfile.id,
    volume_id: parsed.data.volumeId,
    missing_prerequisite_volume_id: parsed.data.missingPrerequisiteVolumeId,
    justification: parsed.data.justification,
    authorized_by: authContext.userId,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Já existe uma exceção idêntica registrada para este aluno."
        : "Não foi possível registrar a exceção.",
    };
  }

  revalidatePath("/coordenacao/matriculas");
  return { success: true };
}
