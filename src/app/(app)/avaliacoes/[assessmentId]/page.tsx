import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { StartAssessmentButton } from "@/modules/assessment/components/StartAssessmentButton";
import { AssessmentPrep } from "@/modules/assessment/components/AssessmentPrep";

export const metadata: Metadata = { title: "Avaliação" };

export default async function AssessmentIntroPage({
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

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, type, questions_count, duration_minutes, closes_at, passing_grade, season_volume_offering_id")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) {
    notFound();
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", authContext.userId)
    .eq("season_volume_offering_id", assessment.season_volume_offering_id)
    .maybeSingle();

  if (!enrollment) {
    notFound();
  }

  const { data: attempts } = await supabase
    .from("assessment_attempts")
    .select("id, status, score, correct_count, total_count")
    .eq("assessment_id", assessmentId)
    .eq("enrollment_id", enrollment.id)
    .order("created_at", { ascending: false });

  const inProgress = (attempts ?? []).find((a) => a.status === "in_progress");
  const hasSubmitted = (attempts ?? []).some((a) => a.status === "submitted" || a.status === "expired");

  // Mesma regra de start_assessment_attempt: 1 tentativa, ou 2 quando há autorização excepcional da coordenação.
  const { count: grantCount } = await supabase
    .from("assessment_exceptional_grants")
    .select("assessment_id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .eq("enrollment_id", enrollment.id);
  const attemptsAllowed = (grantCount ?? 0) > 0 ? 2 : 1;
  const attemptsUsed = (attempts ?? []).length;
  const outOfAttempts = hasSubmitted && attemptsUsed >= attemptsAllowed;

  let recoveryBlocked = false;
  let pendingItems: string[] = [];

  if (assessment.type === "recovery") {
    const { data: items } = await supabase
      .from("recovery_path_items")
      .select("id, content_id, activity_id")
      .eq("assessment_id", assessmentId);

    if (items && items.length > 0) {
      const contentIds = items.filter((i) => i.content_id).map((i) => i.content_id as string);
      const activityIds = items.filter((i) => i.activity_id).map((i) => i.activity_id as string);

      const [{ data: progress }, { data: submittedActivities }] = await Promise.all([
        contentIds.length
          ? supabase
              .from("content_progress")
              .select("content_id, completed_at")
              .eq("enrollment_id", enrollment.id)
              .in("content_id", contentIds)
          : Promise.resolve({ data: [] }),
        activityIds.length
          ? supabase
              .from("activity_attempts")
              .select("activity_id")
              .eq("enrollment_id", enrollment.id)
              .eq("status", "submitted")
              .in("activity_id", activityIds)
          : Promise.resolve({ data: [] }),
      ]);

      const completedContentIds = new Set(
        (progress ?? []).filter((p) => p.completed_at).map((p) => p.content_id),
      );
      const submittedActivityIds = new Set((submittedActivities ?? []).map((a) => a.activity_id));

      const pendingContent = contentIds.filter((id) => !completedContentIds.has(id));
      const pendingActivity = activityIds.filter((id) => !submittedActivityIds.has(id));
      recoveryBlocked = pendingContent.length > 0 || pendingActivity.length > 0;
      pendingItems = [
        ...pendingContent.map(() => "conteúdo pendente"),
        ...pendingActivity.map(() => "exercício pendente"),
      ];
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AssessmentPrep
        title={assessment.title}
        type={assessment.type}
        questionsCount={assessment.questions_count}
        durationMinutes={assessment.duration_minutes}
        passingGrade={assessment.passing_grade}
        closesAt={assessment.closes_at}
        attemptsAllowed={attemptsAllowed}
        attemptsUsed={attemptsUsed}
      >
        {inProgress ? (
          <Link href={`/avaliacoes/${assessmentId}/prova`} className={buttonVariants({ variant: "primary" })}>
            Continuar avaliação em andamento
          </Link>
        ) : outOfAttempts ? (
          <Alert variant="info">
            Você já enviou esta avaliação.{" "}
            <Link href={`/avaliacoes/${assessmentId}/resultado`} className="font-medium underline">
              Ver resultado
            </Link>
          </Alert>
        ) : recoveryBlocked ? (
          <Alert variant="danger">
            Conclua a trilha de revisão obrigatória ({pendingItems.length} item(ns) pendente(s)) antes de tentar a recuperação.
          </Alert>
        ) : (
          <>
            {hasSubmitted ? (
              <Alert variant="info">
                Sua primeira tentativa já foi enviada.{" "}
                <Link href={`/avaliacoes/${assessmentId}/resultado`} className="font-medium underline">
                  Ver resultado
                </Link>{" "}
                A coordenação autorizou mais uma tentativa.
              </Alert>
            ) : null}
            <div className={hasSubmitted ? "mt-3" : ""}>
              <StartAssessmentButton assessmentId={assessmentId} />
            </div>
          </>
        )}
      </AssessmentPrep>
    </div>
  );
}
