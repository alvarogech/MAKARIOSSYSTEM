"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { updateEnrollmentStatusSchema, transferEnrollmentClassSchema } from "../schemas";

export interface UpdateEnrollmentStatusState {
  error?: string;
  success?: boolean;
}

/**
 * Muda o status de uma matrícula já existente (ex.: cancelar, trancar,
 * reativar). Nunca apaga a matrícula de verdade — o histórico de que um
 * aluno já esteve matriculado (e por quê deixou de estar) é informação
 * útil pra coordenação, não um dado descartável. Não há política de RLS
 * de DELETE em `enrollments` de propósito; isto é o mecanismo oficial.
 */
export async function updateEnrollmentStatus(
  _prevState: UpdateEnrollmentStatusState,
  formData: FormData,
): Promise<UpdateEnrollmentStatusState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollments", action: "manage" })) {
    return { error: "Você não tem permissão para alterar matrículas." };
  }

  const parsed = updateEnrollmentStatusSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("enrollments")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.enrollmentId);

  if (error) {
    return { error: "Não foi possível atualizar o status da matrícula." };
  }

  revalidatePath("/coordenacao/matriculas");
  return { success: true };
}

export interface TransferEnrollmentClassState {
  error?: string;
  success?: boolean;
}

/**
 * Move o aluno para outra turma da MESMA oferta de volume (ex.: trocar do
 * sábado pro domingo). Mudar de oferta/volume é uma matrícula nova, não
 * uma transferência — por isso só a turma muda aqui, nunca a oferta; um
 * trigger no banco (enforce_enrollment_class_offering) barra qualquer
 * tentativa de apontar pra uma turma de outra oferta.
 */
export async function transferEnrollmentClass(
  _prevState: TransferEnrollmentClassState,
  formData: FormData,
): Promise<TransferEnrollmentClassState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollments", action: "manage" })) {
    return { error: "Você não tem permissão para alterar matrículas." };
  }

  const parsed = transferEnrollmentClassSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    classId: formData.get("classId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("enrollments")
    .update({ class_id: parsed.data.classId })
    .eq("id", parsed.data.enrollmentId);

  if (error) {
    return {
      error: "Não foi possível mover o aluno — confirme que a turma escolhida é da mesma oferta de volume.",
    };
  }

  revalidatePath("/coordenacao/matriculas");
  return { success: true };
}
