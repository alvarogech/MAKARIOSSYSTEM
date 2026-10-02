"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { ENROLLMENT_SCHEDULES, type EnrollmentScheduleSlug } from "@/config/enrollment";
import { resolveCourseForSlugs } from "../studentInvite";

export interface ChangeEnrollmentScheduleState {
  error?: string;
  success?: boolean;
}

/**
 * Muda o horário (turma) de uma inscrição, em qualquer estágio — antes de
 * aprovar, depois de aprovar mas antes do convite ser aceito, ou já com
 * matrícula de verdade. Nunca muda o volume, só a turma dentro do mesmo
 * volume/oferta. A pessoa não precisa ter aceitado convite nenhum pra
 * isso funcionar:
 *  - sempre atualiza `enrollment_requests` (fonte da verdade do pedido);
 *  - se já existe convite pendente (aprovado, ainda não aceito), atualiza
 *    `class_ids` nele, pra quando a pessoa aceitar cair na turma certa;
 *  - se já existe matrícula de verdade (aceitou), move `enrollments` —
 *    mesma lógica de `transferEnrollmentClass`.
 */
export async function changeEnrollmentSchedule(
  _prevState: ChangeEnrollmentScheduleState,
  formData: FormData,
): Promise<ChangeEnrollmentScheduleState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return { error: "Você não tem permissão para alterar inscrições." };
  }

  const enrollmentRequestId = formData.get("enrollmentRequestId");
  const scheduleSlug = formData.get("scheduleSlug");
  if (typeof enrollmentRequestId !== "string" || typeof scheduleSlug !== "string") {
    return { error: "Dados inválidos." };
  }
  if (!ENROLLMENT_SCHEDULES.some((s) => s.slug === scheduleSlug)) {
    return { error: "Horário inválido." };
  }
  const newScheduleSlug = scheduleSlug as EnrollmentScheduleSlug;

  const supabase = await createSupabaseServerClient();

  const { data: request } = await supabase
    .from("enrollment_requests")
    .select("id, season_id, primary_volume_slug, primary_schedule_slug, student_id")
    .eq("id", enrollmentRequestId)
    .maybeSingle();

  if (!request) return { error: "Inscrição não encontrada." };
  if (request.primary_schedule_slug === newScheduleSlug) {
    return { error: "Já está nesse horário." };
  }

  const newCourse = await resolveCourseForSlugs(
    supabase,
    request.season_id,
    request.primary_volume_slug,
    newScheduleSlug,
  );
  if (!newCourse) {
    return { error: "Não existe turma com esse horário para este volume nesta temporada." };
  }

  const { error: requestUpdateError } = await supabase
    .from("enrollment_requests")
    .update({ primary_schedule_slug: newScheduleSlug })
    .eq("id", request.id);
  if (requestUpdateError) {
    return { error: "Não foi possível atualizar a inscrição." };
  }

  if (request.student_id) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", request.student_id)
      .eq("season_volume_offering_id", newCourse.seasonVolumeOfferingId)
      .maybeSingle();

    if (enrollment) {
      const { error } = await supabase
        .from("enrollments")
        .update({ class_id: newCourse.classId })
        .eq("id", enrollment.id);
      if (error) return { error: "A inscrição foi atualizada, mas não foi possível mover a matrícula já existente." };
    }
  } else {
    const { data: invitation } = await supabase
      .from("invitations")
      .select("id, class_ids")
      .eq("enrollment_request_id", request.id)
      .eq("purpose", "student_onboarding")
      .is("consumed_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (invitation) {
      const classIds = invitation.class_ids ?? [];
      const { data: oldClasses } = await supabase
        .from("classes")
        .select("id, season_volume_offering_id")
        .in("id", classIds);
      const updatedClassIds = classIds.map((id) => {
        const match = oldClasses?.find((c) => c.id === id);
        return match?.season_volume_offering_id === newCourse.seasonVolumeOfferingId ? newCourse.classId : id;
      });
      const { error } = await supabase
        .from("invitations")
        .update({ class_ids: updatedClassIds })
        .eq("id", invitation.id);
      if (error) return { error: "A inscrição foi atualizada, mas não foi possível atualizar o convite já enviado." };
    }
  }

  revalidatePath("/coordenacao/inscricoes");
  return { success: true };
}
