"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { can, getAuthContext } from "@/authorization";
import { submitClassReportSchema } from "../schemas";

export interface SubmitClassReportState {
  error?: string;
  success?: boolean;
}

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
    planChanged: formData.get("planChanged") === "on",
    planChangeNotes: formData.get("planChangeNotes") || undefined,
    recurringQuestions: formData.get("recurringQuestions") || undefined,
    occurrences: formData.get("occurrences") || undefined,
    studentsNeedingAttention: formData.get("studentsNeedingAttention") || undefined,
    observation: formData.get("observation") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_meeting_reports").upsert(
    {
      meeting_id: parsed.data.meetingId,
      teacher_id: authContext.userId,
      content_completed: parsed.data.contentCompleted ?? null,
      plan_changed: parsed.data.planChanged ?? false,
      plan_change_notes: parsed.data.planChangeNotes ?? null,
      recurring_questions: parsed.data.recurringQuestions ?? null,
      occurrences: parsed.data.occurrences ?? null,
      students_needing_attention: parsed.data.studentsNeedingAttention ?? null,
      observation: parsed.data.observation ?? null,
    },
    { onConflict: "meeting_id,teacher_id" },
  );

  if (error) {
    return { error: "Não foi possível enviar o relatório." };
  }

  revalidatePath("/professor/turmas");
  revalidatePath("/coordenacao/relatorios");
  return { success: true };
}
