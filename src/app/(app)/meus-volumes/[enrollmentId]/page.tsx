import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadVolumeOutline } from "@/modules/learning/loadVolumeOutline";

export const metadata: Metadata = { title: "Volume" };

export default async function VolumeOutlinePage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  // RLS já garante que só a própria matrícula é lida (enrollments_select_own).
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, season_volume_offering_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) {
    notFound();
  }

  const { data: offering } = await supabase
    .from("season_volume_offerings")
    .select("volume_id")
    .eq("id", enrollment.season_volume_offering_id)
    .single();

  if (!offering) {
    notFound();
  }

  const { data: volume } = await supabase
    .from("volumes")
    .select("name")
    .eq("id", offering.volume_id)
    .single();

  const modules = await loadVolumeOutline(supabase, enrollment.id, offering.volume_id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-neutral-900">{volume?.name ?? "Volume"}</h1>

      {modules.map((module_) => (
        <Card key={module_.id}>
          <h2 className="font-semibold text-neutral-900">{module_.name}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {module_.lessons.map((lesson) => (
              <div key={lesson.id} className="border-t border-neutral-100 pt-3 first:border-none first:pt-0">
                <p className="text-sm font-medium text-neutral-700">{lesson.name}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {lesson.contents.map((content) => (
                    <li key={content.id} className="flex items-center gap-2 text-sm">
                      {content.released ? (
                        content.completed ? (
                          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                        ) : (
                          <PlayCircle className="size-4 text-brand-blue" aria-hidden="true" />
                        )
                      ) : (
                        <Lock className="size-4 text-neutral-300" aria-hidden="true" />
                      )}
                      {content.released ? (
                        <Link
                          href={`/aula/${content.id}?enrollmentId=${enrollment.id}`}
                          className="text-neutral-700 hover:text-brand-blue hover:underline"
                        >
                          {content.title}
                        </Link>
                      ) : (
                        <span className="text-neutral-400">{content.title}</span>
                      )}
                      {content.classification === "obrigatorio" ? (
                        <span className="text-xs text-neutral-400">(obrigatório)</span>
                      ) : null}
                      {content.released && content.type === "video" && !content.completed && content.progressPercent > 0 ? (
                        <span className="text-xs text-neutral-400">{content.progressPercent}%</span>
                      ) : null}
                    </li>
                  ))}
                  {lesson.activities.map((activity) => (
                    <li key={activity.id} className="flex items-center gap-2 text-sm">
                      <PlayCircle className="size-4 text-brand-blue" aria-hidden="true" />
                      <Link
                        href={`/exercicios/${activity.id}?enrollmentId=${enrollment.id}`}
                        className="text-neutral-700 hover:text-brand-blue hover:underline"
                      >
                        {activity.title}
                      </Link>
                      <span className="text-xs text-neutral-400">(exercício)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {module_.lessons.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhuma aula publicada ainda.</p>
            ) : null}
          </div>
        </Card>
      ))}

      {modules.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum módulo publicado ainda para este volume.</p>
      ) : null}
    </div>
  );
}
