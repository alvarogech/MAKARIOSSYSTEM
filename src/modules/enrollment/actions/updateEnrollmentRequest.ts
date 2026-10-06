"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { can, getAuthContext } from "@/authorization";
import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { escapeIlike } from "@/modules/auth/lookupTeacherCandidate";
import { volumeLabel, scheduleLabel } from "../labels";
import { resolveCourseForSlugs, type ResolvedCourse } from "../studentInvite";

export interface UpdateEnrollmentRequestState {
  error?: string;
  success?: string;
}

const volumeSlugs = ENROLLMENT_VOLUMES.map((v) => v.slug) as [string, ...string[]];
const scheduleSlugs = ENROLLMENT_SCHEDULES.map((s) => s.slug) as [string, ...string[]];

const schema = z
  .object({
    enrollmentRequestId: z.string().uuid("Inscrição inválida."),
    fullName: z.string().trim().min(3, "Informe o nome completo."),
    email: z.string().trim().toLowerCase().min(1, "Informe o e-mail.").email("E-mail inválido."),
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length >= 10 && value.length <= 11, "WhatsApp incompleto — informe com DDD."),
    primaryVolume: z.enum(volumeSlugs, { message: "Escolha o volume principal." }),
    primarySchedule: z.enum(scheduleSlugs, { message: "Escolha o horário principal." }),
    wantsSecondVolume: z.boolean(),
    secondaryVolume: z.string().optional(),
    secondarySchedule: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (!data.wantsSecondVolume) return;
    if (!data.secondaryVolume || !volumeSlugs.includes(data.secondaryVolume)) {
      context.addIssue({ code: "custom", path: ["secondaryVolume"], message: "Escolha o segundo volume." });
    } else if (data.secondaryVolume === data.primaryVolume) {
      context.addIssue({ code: "custom", path: ["secondaryVolume"], message: "O segundo volume precisa ser diferente do principal." });
    }
    if (!data.secondarySchedule || !scheduleSlugs.includes(data.secondarySchedule)) {
      context.addIssue({ code: "custom", path: ["secondarySchedule"], message: "Escolha o horário do segundo volume." });
    } else if (data.secondarySchedule === data.primarySchedule) {
      context.addIssue({ code: "custom", path: ["secondarySchedule"], message: "Os dois volumes precisam ser em horários diferentes." });
    }
  });

/**
 * Edição completa de uma inscrição pela plataforma: dados de contato, volume
 * e horário do curso principal e do segundo volume — em qualquer estágio
 * (pendente ou aprovada, com ou sem convite aceito). Tudo que já existe a
 * partir da inscrição é mantido em sincronia:
 *  - convite pendente: turmas, nome e e-mail do convite;
 *  - aluno com conta: matrículas (move de turma, cria a do volume novo e
 *    CANCELA — sem apagar — a do volume que saiu) e nome do perfil.
 * Nada é excluído: o histórico continua nas matrículas canceladas.
 */
export async function updateEnrollmentRequest(
  _prevState: UpdateEnrollmentRequestState,
  formData: FormData,
): Promise<UpdateEnrollmentRequestState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "enrollment_requests", action: "manage" })) {
    return { error: "Você não tem permissão para alterar inscrições." };
  }

  const parsed = schema.safeParse({
    enrollmentRequestId: formData.get("enrollmentRequestId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    primaryVolume: formData.get("primaryVolume"),
    primarySchedule: formData.get("primarySchedule"),
    wantsSecondVolume: formData.get("wantsSecondVolume") === "on",
    secondaryVolume: String(formData.get("secondaryVolume") ?? ""),
    secondarySchedule: String(formData.get("secondarySchedule") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data: request } = await supabase
    .from("enrollment_requests")
    .select(
      "id, season_id, status, student_id, full_name, email, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug",
    )
    .eq("id", input.enrollmentRequestId)
    .maybeSingle();
  if (!request) return { error: "Inscrição não encontrada." };
  if (request.status !== "pending" && request.status !== "approved") {
    return { error: "Só dá para editar inscrições pendentes ou aprovadas." };
  }

  const emailChanged = input.email !== request.email.trim().toLowerCase();
  if (request.student_id && emailChanged) {
    return {
      error:
        "Esta pessoa já criou a conta, e o e-mail é o login dela — não dá para trocar por aqui. " +
        "Para ajudar com acesso, gere um link de nova senha.",
    };
  }

  // Cursos desejados — primeiro valida que as turmas existem, antes de gravar qualquer coisa.
  const desired: { label: string; course: ResolvedCourse }[] = [];
  const primary = await resolveCourseForSlugs(supabase, request.season_id, input.primaryVolume, input.primarySchedule);
  if (!primary) {
    return {
      error: `Não existe turma de ${volumeLabel(input.primaryVolume)} (${scheduleLabel(input.primarySchedule)}) nesta temporada.`,
    };
  }
  desired.push({ label: "principal", course: primary });

  if (input.wantsSecondVolume) {
    const secondary = await resolveCourseForSlugs(
      supabase,
      request.season_id,
      input.secondaryVolume!,
      input.secondarySchedule!,
    );
    if (!secondary) {
      return {
        error: `Não existe turma de ${volumeLabel(input.secondaryVolume!)} (${scheduleLabel(input.secondarySchedule!)}) nesta temporada.`,
      };
    }
    desired.push({ label: "segundo", course: secondary });
  }

  // Cursos anteriores (para saber quais ofertas saíram da inscrição).
  const previousOfferingIds = new Set<string>();
  const previousCourses = [
    await resolveCourseForSlugs(supabase, request.season_id, request.primary_volume_slug, request.primary_schedule_slug),
    request.wants_second_volume && request.secondary_volume_slug && request.secondary_schedule_slug
      ? await resolveCourseForSlugs(supabase, request.season_id, request.secondary_volume_slug, request.secondary_schedule_slug)
      : null,
  ];
  for (const course of previousCourses) if (course) previousOfferingIds.add(course.seasonVolumeOfferingId);

  const { error: updateError } = await supabase
    .from("enrollment_requests")
    .update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      primary_volume_slug: input.primaryVolume,
      primary_schedule_slug: input.primarySchedule,
      wants_second_volume: input.wantsSecondVolume,
      secondary_volume_slug: input.wantsSecondVolume ? input.secondaryVolume! : null,
      secondary_schedule_slug: input.wantsSecondVolume ? input.secondarySchedule! : null,
    })
    .eq("id", request.id);
  if (updateError) return { error: "Não foi possível salvar a inscrição." };

  const notes: string[] = [];
  const desiredOfferingIds = new Set(desired.map((d) => d.course.seasonVolumeOfferingId));

  if (request.student_id) {
    // Aluno com conta: sincroniza as matrículas.
    for (const { course } of desired) {
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id, class_id, status")
        .eq("student_id", request.student_id)
        .eq("season_volume_offering_id", course.seasonVolumeOfferingId)
        .maybeSingle();

      if (existing) {
        const needsReactivation = existing.status === "canceled" || existing.status === "withdrawn";
        if (existing.class_id !== course.classId || needsReactivation) {
          const { error } = await supabase
            .from("enrollments")
            .update({ class_id: course.classId, ...(needsReactivation ? { status: "active" } : {}) })
            .eq("id", existing.id);
          if (error) return { error: `A inscrição foi salva, mas não foi possível atualizar a matrícula em ${course.volumeName}.` };
          notes.push(`matrícula em ${course.volumeName} movida para ${course.className}`);
        }
      } else {
        const { error } = await supabase.from("enrollments").insert({
          student_id: request.student_id,
          class_id: course.classId,
          season_volume_offering_id: course.seasonVolumeOfferingId,
          status: "active",
          authorized_by: authContext.userId,
        });
        if (error) return { error: `A inscrição foi salva, mas não foi possível criar a matrícula em ${course.volumeName}.` };
        notes.push(`matrícula criada em ${course.volumeName} (${course.className})`);
      }
    }

    for (const offeringId of previousOfferingIds) {
      if (desiredOfferingIds.has(offeringId)) continue;
      const { data: removed } = await supabase
        .from("enrollments")
        .update({ status: "canceled" })
        .eq("student_id", request.student_id)
        .eq("season_volume_offering_id", offeringId)
        .eq("status", "active")
        .select("id");
      if (removed && removed.length > 0) notes.push("matrícula do volume anterior cancelada (histórico mantido)");
    }

    if (input.fullName !== request.full_name) {
      await admin.from("profiles").update({ full_name: input.fullName }).eq("id", request.student_id);
    }
  } else {
    // Ainda sem conta: ajusta o convite pendente (se houver).
    const { data: invitation } = await supabase
      .from("invitations")
      .select("id")
      .eq("enrollment_request_id", request.id)
      .eq("purpose", "student_onboarding")
      .is("consumed_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (invitation) {
      const patch: {
        class_ids: string[];
        intended_full_name: string;
        email?: string;
        initial_email_sent_at?: null;
        use_access_code?: boolean;
      } = {
        class_ids: desired.map((d) => d.course.classId),
        intended_full_name: input.fullName,
      };

      if (emailChanged) {
        // O convite precisa ir de novo para o e-mail correto: zera o "já enviado"
        // para o envio automático pegá-lo com prioridade.
        patch.email = input.email;
        patch.initial_email_sent_at = null;

        const [{ data: sameEmailProfiles }, { data: sameEmailInvites }] = await Promise.all([
          admin.from("profiles").select("id").ilike("email", escapeIlike(input.email)).limit(1),
          admin
            .from("invitations")
            .select("id")
            .eq("purpose", "student_onboarding")
            .eq("channel", "email")
            .ilike("email", escapeIlike(input.email))
            .is("consumed_at", null)
            .is("revoked_at", null)
            .neq("id", invitation.id)
            .limit(1),
        ]);
        patch.use_access_code = (sameEmailProfiles?.length ?? 0) > 0 || (sameEmailInvites?.length ?? 0) > 0;
        notes.push("convite atualizado para o novo e-mail — será reenviado automaticamente");
      } else {
        notes.push("turmas do convite atualizadas");
      }

      const { error } = await supabase.from("invitations").update(patch).eq("id", invitation.id);
      if (error) return { error: "A inscrição foi salva, mas não foi possível atualizar o convite já gerado." };
    }
  }

  revalidatePath("/coordenacao/inscricoes");
  revalidatePath("/coordenacao/matriculas");
  return { success: notes.length > 0 ? `Salvo: ${notes.join("; ")}.` : "Inscrição atualizada." };
}
