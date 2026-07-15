"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { assignTeacherSchema } from "../schemas";
import { findUserIdByEmailAndRole } from "../lookupUser";

export interface AssignTeacherState {
  error?: string;
  success?: boolean;
}

export async function assignTeacher(
  _prevState: AssignTeacherState,
  formData: FormData,
): Promise<AssignTeacherState> {
  const authContext = await getAuthContext();
  if (
    !authContext ||
    !can(authContext, { resource: "teacher_assignments", action: "manage" })
  ) {
    return { error: "Você não tem permissão para designar professores." };
  }

  const parsed = assignTeacherSchema.safeParse({
    classId: formData.get("classId"),
    teacherEmail: formData.get("teacherEmail"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const teacher = await findUserIdByEmailAndRole(
    supabase,
    parsed.data.teacherEmail,
    "teacher",
  );

  if (!teacher) {
    return {
      error:
        "Nenhum usuário com perfil Professor foi encontrado com esse e-mail. " +
        "Convide a pessoa como Professor primeiro.",
    };
  }

  const { error } = await supabase.from("teacher_assignments").insert({
    teacher_id: teacher.userId,
    class_id: parsed.data.classId,
    function: "regente",
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Este professor já está designado a esta turma."
        : "Não foi possível designar o professor.",
    };
  }

  revalidatePath("/coordenacao/turmas");
  return { success: true };
}
