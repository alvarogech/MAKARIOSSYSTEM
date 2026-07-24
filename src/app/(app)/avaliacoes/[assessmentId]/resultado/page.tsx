import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { isGradeSufficient } from "@/services/assessmentGrading";
import { AssessmentReview } from "@/modules/assessment/components/AssessmentReview";

export const metadata: Metadata = { title: "Resultado" };

export default async function AssessmentResultPage({
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
    .select("id, title, type, passing_grade, answer_key_released_at, linked_assessment_id, season_volume_offering_id")
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

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id, status, score, correct_count, total_count, submitted_at")
    .eq("assessment_id", assessmentId)
    .eq("enrollment_id", enrollment.id)
    .in("status", ["submitted", "expired"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) {
    notFound();
  }

  const passed = attempt.score !== null && isGradeSufficient(attempt.score, assessment.passing_grade);

  // Avaliação de recuperação vinculada — só relevante quando esta é a
  // avaliação "final" e o aluno não atingiu a nota mínima.
  let recoveryAssessmentId: string | null = null;
  if (assessment.type === "final" && !passed) {
    const { data: recovery } = await supabase
      .from("assessments")
      .select("id")
      .eq("linked_assessment_id", assessmentId)
      .eq("type", "recovery")
      .maybeSingle();
    recoveryAssessmentId = recovery?.id ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">{assessment.title} — Resultado</h1>

        {attempt.score !== null ? (
          <Alert variant={passed ? "success" : "danger"}>
            Nota: {attempt.score} — {attempt.correct_count} de {attempt.total_count} questões
            corretas. {passed ? "Aprovado nesta avaliação." : "Abaixo da nota mínima."}
          </Alert>
        ) : (
          <Alert variant="info">Sua avaliação foi enviada e está aguardando correção.</Alert>
        )}

        {!passed && recoveryAssessmentId ? (
          <div className="mt-3">
            <Link
              href={`/avaliacoes/${recoveryAssessmentId}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Ir para a recuperação
            </Link>
          </div>
        ) : null}

        {!assessment.answer_key_released_at ? (
          <p className="mt-3 text-sm text-neutral-500">
            O gabarito ainda não foi liberado. Assim que for, você poderá
            ver aqui a resposta correta de cada questão e a explicação.
          </p>
        ) : null}
      </Card>

      {assessment.answer_key_released_at ? (
        <Card>
          <h2 className="font-semibold text-neutral-900">Gabarito</h2>
          <div className="mt-3">
            <AssessmentReview attemptId={attempt.id} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
