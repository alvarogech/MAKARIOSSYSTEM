"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { assignTeacherSchema } from "../schemas";
import { findUserIdByEmailAndRole } from "../lookupUser";

export interface AssignTeacherState {
  error?: string;
  success?: boolean;
  warning?: string;
}

interface TemplateSlot {
  weekdays: string[];
  startTime: string;
  endTime: string;
}

function slotsOverlap(a: TemplateSlot, b: TemplateSlot): boolean {
  const sharesWeekday = a.weekdays.some((day) => b.weekdays.includes(day));
  if (!sharesWeekday) return false;
  // start_time/end_time do Postgres vêm como "HH:MM:SS", largura fixa —
  // comparação de string equivale à comparação de horário.
  return a.startTime < b.endTime && b.startTime < a.endTime;
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
    moduleId: formData.get("moduleId") || undefined,
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

  // Checagem de choque de horário: nunca bloqueia (é um alerta, não um
  // pré-requisito), só avisa a coordenação se o mesmo professor já está
  // designado, EM ESCOPO DE TURMA INTEIRA, a outra turma cujo modelo de
  // horário se sobrepõe ao desta.
  //
  // Importante: essa comparação usa o horário total do `class_template`
  // (ex.: "Sábado 08h-12h30"), não o horário real de uma matéria dentro do
  // dia. Por isso, só faz sentido quando AMBOS os vínculos — o que está
  // sendo criado agora e o que já existe — são de turma inteira (sem
  // module_id/meeting_id). Um vínculo por matéria cobre só uma fração do
  // dia por definição; comparar seu "dia inteiro" contra outra turma no
  // mesmo horário geral gerava falso positivo (ex.: mesmo professor dando
  // uma matéria de Essência das 8h-10h e outra de Caminho das 10h30-12h30,
  // ambas aos sábados — vínculos válidos, sem sobreposição real). A
  // detecção de conflito real por matéria/horário fica a cargo de
  // `detectScheduleConflicts` sobre `class_meeting_blocks`, que compara
  // intervalos de horário de verdade, não o molde da turma inteira.
  let warning: string | undefined;

  if (!parsed.data.moduleId) {
    const { data: targetClass } = await supabase
      .from("classes")
      .select("name, class_templates(weekdays, start_time, end_time)")
      .eq("id", parsed.data.classId)
      .maybeSingle();

    const targetTemplate = targetClass?.class_templates as unknown as
      | { weekdays: string[]; start_time: string; end_time: string }
      | null
      | undefined;

    if (targetTemplate) {
      const { data: otherAssignments } = await supabase
        .from("teacher_assignments")
        .select(
          "class_id, module_id, classes(name, class_templates(weekdays, start_time, end_time))",
        )
        .eq("teacher_id", teacher.userId)
        .is("module_id", null)
        .neq("class_id", parsed.data.classId);

      const targetSlot: TemplateSlot = {
        weekdays: targetTemplate.weekdays,
        startTime: targetTemplate.start_time,
        endTime: targetTemplate.end_time,
      };

      const conflictingClassNames = new Set<string>();
      for (const assignment of otherAssignments ?? []) {
        const otherClass = assignment.classes as unknown as
          | {
              name: string;
              class_templates: { weekdays: string[]; start_time: string; end_time: string } | null;
            }
          | null;
        const otherTemplate = otherClass?.class_templates;
        if (!otherTemplate) continue;

        const otherSlot: TemplateSlot = {
          weekdays: otherTemplate.weekdays,
          startTime: otherTemplate.start_time,
          endTime: otherTemplate.end_time,
        };

        if (slotsOverlap(targetSlot, otherSlot)) {
          conflictingClassNames.add(otherClass!.name);
        }
      }

      if (conflictingClassNames.size > 0) {
        warning =
          `Atenção: ${teacher.fullName} já está designado (turma inteira) a outra turma com ` +
          `horário conflitante (${Array.from(conflictingClassNames).join(", ")}). A designação ` +
          "foi salva mesmo assim — confira se não é um choque de agenda real.";
      }
    }
  }

  const { error } = await supabase.from("teacher_assignments").insert({
    teacher_id: teacher.userId,
    class_id: parsed.data.classId,
    module_id: parsed.data.moduleId ?? null,
    function: "regente",
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Este professor já está designado a esta turma/matéria."
        : "Não foi possível designar o professor.",
    };
  }

  revalidatePath("/coordenacao/turmas");
  return { success: true, warning };
}
