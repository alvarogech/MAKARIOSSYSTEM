import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { ActivityPlayer } from "@/modules/learning/components/ActivityPlayer";

export const metadata: Metadata = { title: "Exercício" };

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const { activityId } = await params;
  const { enrollmentId } = await searchParams;

  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  // RLS de `activities` já garante que só exercício publicado do volume
  // matriculado do aluno é retornado (activities_select_student).
  const { data: activity } = await supabase
    .from("activities")
    .select("id, title, instructions")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity) {
    notFound();
  }

  // Tentativas do próprio aluno (RLS): a em andamento e a última enviada.
  const { data: attempts } = await supabase
    .from("activity_attempts")
    .select("id, status, correct_count, total_count, submitted_at, started_at")
    .eq("activity_id", activityId)
    .order("started_at", { ascending: false });
  const inProgress = (attempts ?? []).some((a) => a.status === "in_progress");
  const lastSubmitted = (attempts ?? []).find((a) => a.status === "submitted");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meu-aprendizado" className="text-sm text-brand-blue hover:underline">
        ← Voltar ao Meu aprendizado
      </Link>
      {enrollmentId ? (
        <Link href={`/meus-volumes/${enrollmentId}`} className="text-sm text-neutral-500 hover:underline">
          Ver o volume
        </Link>
      ) : null}

      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">{activity.title}</h1>
        {activity.instructions ? (
          <p className="mt-1 text-sm text-neutral-500">{activity.instructions}</p>
        ) : null}
        <p className="mt-1 text-xs text-neutral-400">
          Exercício de fixação — não vale nota.
        </p>

        <div className="mt-4">
          <ActivityPlayer
            activityId={activity.id}
            inProgress={inProgress}
            last={
              lastSubmitted
                ? {
                    attemptId: lastSubmitted.id,
                    correct: lastSubmitted.correct_count ?? 0,
                    total: lastSubmitted.total_count ?? 0,
                  }
                : null
            }
          />
        </div>
      </Card>
    </div>
  );
}
