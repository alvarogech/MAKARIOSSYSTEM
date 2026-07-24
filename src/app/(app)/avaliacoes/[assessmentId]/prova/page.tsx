import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { AssessmentRunner } from "@/modules/assessment/components/AssessmentRunner";

export const metadata: Metadata = { title: "Prova" };

export default async function AssessmentProvaPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", authContext.userId);

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);

  const { data: attempt } = enrollmentIds.length
    ? await supabase
        .from("assessment_attempts")
        .select("id, deadline_at, status")
        .eq("assessment_id", assessmentId)
        .in("enrollment_id", enrollmentIds)
        .eq("status", "in_progress")
        .maybeSingle()
    : { data: null };

  if (!attempt) {
    redirect(`/avaliacoes/${assessmentId}`);
  }

  return (
    <AssessmentRunner
      assessmentId={assessmentId}
      attemptId={attempt.id}
      deadlineAt={attempt.deadline_at}
    />
  );
}
