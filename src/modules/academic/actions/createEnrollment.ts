"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { checkPrerequisites } from "@/services/prerequisites";
import { createEnrollmentSchema } from "../schemas";
import { findUserIdByEmailAndRole } from "../lookupUser";
import {
  buildPrerequisiteGraph,
  getApprovedVolumeIds,
  getExceptionVolumeIds,
} from "../prerequisiteContext";

export interface CreateEnrollmentState {
  error?: string;
  success?: boolean;
  blocked?: {
    studentEmail: string;
    studentId: string;
    volumeId: string;
    missingVolumeIds: string[];
  };
}

/**
 * Matricula um aluno numa oferta de volume. Bloqueia quando um
 * pré-requisito não está satisfeito (doc 02 §2) — a coordenação pode então
 * autorizar uma exceção (createPrerequisiteException) e tentar de novo.
 * Um aluno pode ter matrículas simultâneas em ofertas diferentes (doc 02 §1).
 */
export async function createEnrollment(
  _prevState: CreateEnrollmentState,
  formData: FormData,
): Promise<CreateEnrollmentState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollments", action: "manage" })) {
    return { error: "Você não tem permissão para matricular alunos." };
  }

  const parsed = createEnrollmentSchema.safeParse({
    studentEmail: formData.get("studentEmail"),
    seasonVolumeOfferingId: formData.get("seasonVolumeOfferingId"),
    classId: formData.get("classId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();

  const student = await findUserIdByEmailAndRole(
    supabase,
    parsed.data.studentEmail,
    "student",
  );

  if (!student) {
    return {
      error:
        "Nenhum usuário com perfil Aluno foi encontrado com esse e-mail. " +
        "Convide a pessoa como Aluno primeiro (ou importe pela planilha).",
    };
  }

  const { data: offering } = await supabase
    .from("season_volume_offerings")
    .select("id, volume_id")
    .eq("id", parsed.data.seasonVolumeOfferingId)
    .single();

  if (!offering) {
    return { error: "Oferta de volume não encontrada." };
  }

  const [graph, approvedVolumeIds, exceptionVolumeIds] = await Promise.all([
    buildPrerequisiteGraph(supabase),
    getApprovedVolumeIds(supabase, student.userId),
    getExceptionVolumeIds(supabase, student.userId, offering.volume_id),
  ]);

  const prerequisiteCheck = checkPrerequisites(
    offering.volume_id,
    graph,
    approvedVolumeIds,
    exceptionVolumeIds,
  );

  if (!prerequisiteCheck.satisfied) {
    return {
      blocked: {
        studentEmail: parsed.data.studentEmail,
        studentId: student.userId,
        volumeId: offering.volume_id,
        missingVolumeIds: prerequisiteCheck.missingVolumeIds,
      },
    };
  }

  const { error } = await supabase.from("enrollments").insert({
    student_id: student.userId,
    season_volume_offering_id: parsed.data.seasonVolumeOfferingId,
    class_id: parsed.data.classId,
    authorized_by: authContext.userId,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Este aluno já está matriculado nesta oferta de volume."
        : "Não foi possível criar a matrícula.",
    };
  }

  revalidatePath("/coordenacao/matriculas");
  return { success: true };
}
