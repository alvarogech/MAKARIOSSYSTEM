"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { assignLessonBlockSchema } from "../schemas";
import { findUserIdByEmailAndRole } from "../lookupUser";

export interface AssignLessonBlockState {
  error?: string;
  success?: boolean;
}

/**
 * Cria um bloco de aula (tema + professor + horário) dentro de um encontro
 * — a escala operacional que distingue "vínculo à turma" de "aula
 * efetivamente atribuída". Não substitui `teacher_assignments` (que
 * continua controlando o escopo/permissão); só o professor com um vínculo
 * de matéria/turma para a turma do encontro deveria ser colocado aqui,
 * mas a checagem de RLS de leitura, não esta action, é quem garante isso —
 * esta action só valida que quem chama é coordenação/admin.
 */
export async function assignLessonBlock(
  _prevState: AssignLessonBlockState,
  formData: FormData,
): Promise<AssignLessonBlockState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "class_meeting_blocks", action: "manage" })) {
    return { error: "Você não tem permissão para definir a escala de aulas." };
  }

  const parsed = assignLessonBlockSchema.safeParse({
    classMeetingId: formData.get("classMeetingId"),
    moduleId: formData.get("moduleId") || undefined,
    teacherEmail: formData.get("teacherEmail") || "",
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    orderIndex: formData.get("orderIndex"),
    coordinationNotes: formData.get("coordinationNotes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.startTime >= parsed.data.endTime) {
    return { error: "O horário de início precisa ser antes do horário de término." };
  }

  const supabase = await createSupabaseServerClient();

  let teacherId: string | null = null;
  if (parsed.data.teacherEmail) {
    const teacher = await findUserIdByEmailAndRole(supabase, parsed.data.teacherEmail, "teacher");
    if (!teacher) {
      return {
        error:
          "Nenhum usuário com perfil Professor foi encontrado com esse e-mail. " +
          "Convide a pessoa como Professor primeiro (ela precisa aceitar o convite).",
      };
    }
    teacherId = teacher.userId;
  }

  const { error } = await supabase.from("class_meeting_blocks").insert({
    class_meeting_id: parsed.data.classMeetingId,
    module_id: parsed.data.moduleId ?? null,
    teacher_id: teacherId,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    order_index: parsed.data.orderIndex,
    coordination_notes: parsed.data.coordinationNotes || null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Já existe um bloco nessa posição para este encontro — use outra posição."
          : "Não foi possível salvar a aula.",
    };
  }

  revalidatePath("/coordenacao/turmas");
  return { success: true };
}

export interface DeleteLessonBlockState {
  error?: string;
  success?: boolean;
}

export async function deleteLessonBlock(
  _prevState: DeleteLessonBlockState,
  formData: FormData,
): Promise<DeleteLessonBlockState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "class_meeting_blocks", action: "manage" })) {
    return { error: "Você não tem permissão para remover aulas da escala." };
  }

  const blockId = formData.get("blockId");
  if (typeof blockId !== "string" || !blockId) {
    return { error: "Aula inválida." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_meeting_blocks").delete().eq("id", blockId);

  if (error) {
    return { error: "Não foi possível remover esta aula." };
  }

  revalidatePath("/coordenacao/turmas");
  return { success: true };
}
