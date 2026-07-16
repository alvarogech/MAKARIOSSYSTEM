import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { ClassReportForm } from "@/modules/teaching/components/ClassReportForm";

export const metadata: Metadata = { title: "Relatório pós-aula" };

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ classId: string; meetingId: string }>;
}) {
  const { classId, meetingId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", authContext.userId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assignment) {
    notFound();
  }

  const { data: meeting } = await supabase
    .from("class_meetings")
    .select("id, sequence")
    .eq("id", meetingId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!meeting) {
    notFound();
  }

  const { data: existingReport } = await supabase
    .from("class_meeting_reports")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("teacher_id", authContext.userId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/professor/turmas/${classId}`} className="text-sm text-brand-blue hover:underline">
        ← Voltar à turma
      </Link>

      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">
          Relatório pós-aula — Encontro {meeting.sequence}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Enviado diretamente à coordenação.</p>

        <div className="mt-4">
          <ClassReportForm
            meetingId={meetingId}
            existing={
              existingReport
                ? {
                    contentCompleted: existingReport.content_completed ?? "",
                    planChanged: existingReport.plan_changed,
                    planChangeNotes: existingReport.plan_change_notes ?? "",
                    recurringQuestions: existingReport.recurring_questions ?? "",
                    occurrences: existingReport.occurrences ?? "",
                    studentsNeedingAttention: existingReport.students_needing_attention ?? "",
                    observation: existingReport.observation ?? "",
                  }
                : null
            }
          />
        </div>
      </Card>
    </div>
  );
}
