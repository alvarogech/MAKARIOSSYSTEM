"use server";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getAuthContext } from "@/authorization";
import { computeVideoProgress, mergeProgressPercent } from "@/services/videoProgress";

export interface UpdateVideoProgressInput {
  enrollmentId: string;
  contentId: string;
  positionSeconds: number;
  durationSeconds: number;
}

export interface UpdateVideoProgressResult {
  ok: boolean;
  percent?: number;
  completed?: boolean;
}

/**
 * Chamada diretamente (não via <form>) pelo player de vídeo no cliente, a
 * cada poucos segundos. O percentual nunca regride (mergeProgressPercent)
 * e "concluído" é decidido aqui, no servidor — o cliente só informa
 * posição/duração brutas.
 */
export async function updateVideoProgress(
  input: UpdateVideoProgressInput,
): Promise<UpdateVideoProgressResult> {
  const authContext = await getAuthContext();
  if (!authContext) {
    return { ok: false };
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("id", input.enrollmentId)
    .eq("student_id", authContext.userId)
    .maybeSingle();

  if (!enrollment) {
    return { ok: false };
  }

  const { data: video } = await supabase
    .from("video_contents")
    .select("min_percent")
    .eq("content_id", input.contentId)
    .maybeSingle();

  if (!video) {
    return { ok: false };
  }

  const { data: existing } = await supabase
    .from("content_progress")
    .select("percent, started_at, completed_at")
    .eq("enrollment_id", input.enrollmentId)
    .eq("content_id", input.contentId)
    .maybeSingle();

  const { percent: newPercent } = computeVideoProgress({
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds,
    minPercent: video.min_percent,
  });

  const mergedPercent = mergeProgressPercent(existing?.percent ?? 0, newPercent);
  const isCompleted = mergedPercent >= video.min_percent;
  const nowIso = new Date().toISOString();

  const { error } = await supabase.from("content_progress").upsert(
    {
      enrollment_id: input.enrollmentId,
      content_id: input.contentId,
      started_at: existing?.started_at ?? nowIso,
      last_position_seconds: Math.round(input.positionSeconds),
      percent: mergedPercent,
      completed_at: isCompleted ? (existing?.completed_at ?? nowIso) : existing?.completed_at ?? null,
    },
    { onConflict: "enrollment_id,content_id" },
  );

  if (error) {
    return { ok: false };
  }

  return { ok: true, percent: mergedPercent, completed: isCompleted };
}
