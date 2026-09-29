import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Link2, Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadVolumeOutline, type OutlineContent } from "@/modules/learning/loadVolumeOutline";

export const metadata: Metadata = { title: "Volume" };

const COMPLEMENTARY_LABELS: Record<string, string> = {
  complementar: "complementar",
  preparatorio: "preparatório",
  aprofundamento: "aprofundamento",
  revisao: "revisão",
};

function ContentIcon({ content }: { content: OutlineContent }) {
  if (!content.released) return <Lock className="size-4 shrink-0 text-neutral-300" aria-hidden="true" />;
  if (content.completed) return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />;
  if (content.type === "video") return <PlayCircle className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />;
  if (content.type === "link") return <Link2 className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />;
  // "file" e "text" são material de leitura, não vídeo — ícone de documento.
  return <FileText className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />;
}

function ContentRow({ content, enrollmentId }: { content: OutlineContent; enrollmentId: string }) {
  const suffixLabel = COMPLEMENTARY_LABELS[content.classification];

  return (
    <li className="flex items-center gap-2 text-sm">
      <ContentIcon content={content} />
      {content.released ? (
        <Link
          href={`/aula/${content.id}?enrollmentId=${enrollmentId}`}
          className="text-neutral-700 hover:text-brand-blue hover:underline"
        >
          {content.title}
        </Link>
      ) : (
        <span className="text-neutral-400">{content.title}</span>
      )}
      {suffixLabel ? <span className="text-xs text-neutral-400">({suffixLabel})</span> : null}
      {content.released && content.type === "video" && !content.completed && content.progressPercent > 0 ? (
        <span className="text-xs text-neutral-400">{content.progressPercent}%</span>
      ) : null}
    </li>
  );
}

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

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, type, status")
    .eq("season_volume_offering_id", enrollment.season_volume_offering_id)
    .eq("status", "open");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-neutral-900">{volume?.name ?? "Volume"}</h1>

      {(assessments ?? []).length > 0 ? (
        <Card>
          <h2 className="font-semibold text-neutral-900">Avaliações</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(assessments ?? []).map((assessment) => (
              <li key={assessment.id}>
                <Link
                  href={`/avaliacoes/${assessment.id}`}
                  className="text-sm text-brand-blue hover:underline"
                >
                  {assessment.title} ({assessment.type === "recovery" ? "recuperação" : "avaliação final"})
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {modules.map((module_) => (
        <Card key={module_.id}>
          <h2 className="font-semibold text-neutral-900">{module_.name}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {module_.lessons.map((lesson) => {
              const apostilas = lesson.contents.filter((c) => c.classification === "obrigatorio");
              const materiaisAdicionais = lesson.contents.filter((c) => c.classification !== "obrigatorio");
              // Todas as aulas hoje se chamam genericamente "Apostila" — repetir
              // isso como subtítulo não agrega nada; só mostramos o nome da
              // aula quando ele carrega informação de verdade.
              const showLessonName = lesson.name !== "Apostila";

              return (
                <div key={lesson.id} className="border-t border-neutral-100 pt-3 first:border-none first:pt-0">
                  {showLessonName ? (
                    <p className="text-sm font-medium text-neutral-700">{lesson.name}</p>
                  ) : null}

                  {apostilas.length > 0 ? (
                    <div className={showLessonName ? "mt-2" : ""}>
                      {apostilas.length > 1 || materiaisAdicionais.length > 0 ? (
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                          Apostilas
                        </p>
                      ) : null}
                      <ul className="mt-1 flex flex-col gap-1">
                        {apostilas.map((content) => (
                          <ContentRow key={content.id} content={content} enrollmentId={enrollment.id} />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {materiaisAdicionais.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Materiais adicionais
                      </p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {materiaisAdicionais.map((content) => (
                          <ContentRow key={content.id} content={content} enrollmentId={enrollment.id} />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {lesson.activities.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {lesson.activities.map((activity) => (
                        <li key={activity.id} className="flex items-center gap-2 text-sm">
                          <PlayCircle className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
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
                  ) : null}

                  {apostilas.length === 0 && materiaisAdicionais.length === 0 && lesson.activities.length === 0 ? (
                    <p className="text-sm text-neutral-400">Nenhum material publicado ainda.</p>
                  ) : null}
                </div>
              );
            })}
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
