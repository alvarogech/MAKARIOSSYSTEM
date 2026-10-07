"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { submitClassReportSchema } from "../schemas";
import { loadReportEligibility } from "../reportSettingsLoader";

export interface SubmitClassReportState {
  error?: string;
  success?: boolean;
}

const REFUSALS = {
  inactive: "Os relatórios pós-aula não estão ativos neste semestre.",
  not_scheduled: "Você não está escalado neste encontro.",
  not_over: "O relatório só abre depois do término da aula.",
} as const;

export async function submitClassReport(
  _prevState: SubmitClassReportState,
  formData: FormData,
): Promise<SubmitClassReportState> {
  const authContext = await getAuthContext();
  if (!authContext || !can(authContext, { resource: "class_reports", action: "submit" })) {
    return { error: "Você não tem permissão para enviar relatório pós-aula." };
  }

  const parsed = submitClassReportSchema.safeParse({
    meetingId: formData.get("meetingId"),
    contentCompleted: formData.get("contentCompleted") || undefined,
    studentsNeedingAttention: formData.get("studentsNeedingAttention") || undefined,
    observation: formData.get("observation") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (!parsed.data.contentCompleted) {
    return { error: "Conte em poucas linhas o que foi dado hoje." };
  }

  const supabase = await createSupabaseServerClient();

  // Mesmas regras do banco (RLS), com mensagem amigável: semestre ativo, professor escalado, encontro encerrado.
  const eligibility = await loadReportEligibility(supabase, parsed.data.meetingId, authContext.userId);
  if (eligibility.state !== "open" || !eligibility.meeting) {
    return { error: eligibility.state === "open" ? "Encontro não encontrado." : REFUSALS[eligibility.state] };
  }

  // Só alunos desta turma podem ser marcados (lista única: matriculados + aguardando acesso).
  const requestedIds = formData.getAll("attentionStudentIds").filter((v): v is string => typeof v === "string");
  const { data: roster } = await supabase.rpc("class_roster", { p_class_id: eligibility.meeting.classId });
  const allowed = new Set((roster ?? []).flatMap((p) => [p.student_id, p.request_id]).filter((id): id is string => Boolean(id)));
  const attentionIds = [...new Set(requestedIds.filter((id) => allowed.has(id)))];

  const { error } = await supabase.from("class_meeting_reports").upsert(
    {
      meeting_id: parsed.data.meetingId,
      teacher_id: authContext.userId,
      content_completed: parsed.data.contentCompleted,
      students_needing_attention: parsed.data.studentsNeedingAttention ?? null,
      attention_student_ids: attentionIds,
      // As antigas "ocorrências" foram juntadas nas observações no formulário.
      occurrences: null,
      observation: parsed.data.observation ?? null,
    },
    { onConflict: "meeting_id,teacher_id" },
  );

  if (error) {
    return { error: "Não foi possível enviar o relatório." };
  }

  revalidatePath("/professor/turmas");
  revalidatePath("/dashboard");
  revalidatePath("/coordenacao/relatorios");
  return { success: true };
}
