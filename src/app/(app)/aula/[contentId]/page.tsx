import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { VideoPlayer } from "@/modules/learning/components/VideoPlayer";

export const metadata: Metadata = { title: "Aula" };

export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const { contentId } = await params;
  const { enrollmentId } = await searchParams;

  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  if (!enrollmentId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  // RLS de `contents` já garante que só conteúdo publicado e do volume da
  // matrícula do aluno é retornado (contents_select_student).
  const { data: content } = await supabase
    .from("contents")
    .select("id, title, description, type, allow_download, estimated_minutes")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) {
    notFound();
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("id", enrollmentId)
    .eq("student_id", authContext.userId)
    .maybeSingle();

  if (!enrollment) {
    notFound();
  }

  const [{ data: video }, { data: files }, { data: fullContent }, { data: progress }] =
    await Promise.all([
      supabase.from("video_contents").select("youtube_video_id, min_percent").eq("content_id", contentId).maybeSingle(),
      supabase.from("content_files").select("id, file_name, file_url").eq("content_id", contentId),
      supabase.from("contents").select("body").eq("id", contentId).single(),
      supabase
        .from("content_progress")
        .select("percent, completed_at")
        .eq("enrollment_id", enrollmentId)
        .eq("content_id", contentId)
        .maybeSingle(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/meus-volumes/${enrollmentId}`} className="text-sm text-brand-blue hover:underline">
        ← Voltar ao volume
      </Link>

      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">{content.title}</h1>
        {content.description ? <p className="mt-1 text-sm text-neutral-500">{content.description}</p> : null}
        {content.estimated_minutes ? (
          <p className="mt-1 text-xs text-neutral-400">Duração estimada: {content.estimated_minutes} min</p>
        ) : null}

        <div className="mt-4">
          {content.type === "video" && video ? (
            <VideoPlayer
              youtubeVideoId={video.youtube_video_id}
              enrollmentId={enrollmentId}
              contentId={contentId}
              initialPercent={progress?.percent ?? 0}
              initialCompleted={Boolean(progress?.completed_at)}
            />
          ) : null}

          {content.type === "file" ? (
            <ul className="flex flex-col gap-2">
              {(files ?? []).map((file) => (
                <li key={file.id}>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    {content.allow_download ? "Baixar" : "Abrir"} {file.file_name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {content.type === "link" && fullContent?.body ? (
            <a
              href={fullContent.body}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary" })}
            >
              Abrir link
            </a>
          ) : null}

          {content.type === "text" && fullContent?.body ? (
            <div className="whitespace-pre-wrap text-sm text-neutral-700">{fullContent.body}</div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
