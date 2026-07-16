import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  isContentReleased,
  type ReleaseRule,
} from "@/services/contentRelease";

export interface OutlineContent {
  id: string;
  title: string;
  type: string;
  classification: string;
  estimatedMinutes: number | null;
  released: boolean;
  progressPercent: number;
  completed: boolean;
}

export interface OutlineActivity {
  id: string;
  title: string;
}

export interface OutlineLesson {
  id: string;
  name: string;
  contents: OutlineContent[];
  activities: OutlineActivity[];
}

export interface OutlineModule {
  id: string;
  name: string;
  lessons: OutlineLesson[];
}

/**
 * Monta a árvore Volume → Módulo → Aula → Conteúdo/Exercício para UMA
 * matrícula, já com o status de liberação (`released`) e o progresso do
 * aluno resolvidos — usa `isContentReleased` (função pura) para decidir,
 * a partir do estado carregado do banco.
 *
 * A visibilidade dos próprios conteúdos/atividades (RLS de `contents`/
 * `activities`) já garante que só o que é publicado e do volume
 * matriculado aparece aqui — esta função só decide "liberado agora ou
 * ainda bloqueado", que é dinâmico e não cabe bem numa policy estática.
 */
export async function loadVolumeOutline(
  supabase: SupabaseClient<Database>,
  enrollmentId: string,
  volumeId: string,
): Promise<OutlineModule[]> {
  const [
    { data: modules },
    { data: lessons },
    { data: contents },
    { data: activities },
    { data: releaseRules },
    { data: progressRows },
    { data: submittedAttempts },
    { data: pastMeetings },
  ] = await Promise.all([
    supabase.from("modules").select("id, name, order_index").eq("volume_id", volumeId).order("order_index"),
    supabase.from("lessons").select("id, module_id, name, order_index").order("order_index"),
    supabase
      .from("contents")
      .select("id, lesson_id, title, type, classification, estimated_minutes, order_index")
      .eq("volume_id", volumeId)
      .order("order_index"),
    supabase.from("activities").select("id, lesson_id, title").eq("status", "published"),
    supabase.from("release_rules").select("*"),
    supabase.from("content_progress").select("content_id, percent, completed_at").eq("enrollment_id", enrollmentId),
    supabase
      .from("activity_attempts")
      .select("activity_id")
      .eq("enrollment_id", enrollmentId)
      .eq("status", "submitted"),
    supabase.from("class_meetings").select("id, meeting_date").not("meeting_date", "is", null),
  ]);

  const now = new Date();
  const today = new Date(now.toISOString().slice(0, 10));

  const completedContentIds = new Set(
    (progressRows ?? []).filter((p) => p.completed_at).map((p) => p.content_id),
  );
  const progressByContentId = new Map(
    (progressRows ?? []).map((p) => [p.content_id, p.percent]),
  );
  const submittedActivityIds = new Set(
    (submittedAttempts ?? []).map((a) => a.activity_id),
  );
  const pastMeetingIds = new Set(
    (pastMeetings ?? [])
      .filter((m) => m.meeting_date && new Date(m.meeting_date) < today)
      .map((m) => m.id),
  );

  const rulesByContentId = new Map<string, ReleaseRule[]>();
  for (const rule of releaseRules ?? []) {
    const list = rulesByContentId.get(rule.content_id) ?? [];
    list.push({
      type: rule.type,
      releaseAt: rule.release_at ? new Date(rule.release_at) : null,
      requiredContentId: rule.required_content_id,
      requiredActivityId: rule.required_activity_id,
      requiredMeetingId: rule.required_meeting_id,
      releasedManually: rule.released_manually,
    });
    rulesByContentId.set(rule.content_id, list);
  }

  const releaseContext = {
    now,
    completedContentIds,
    submittedActivityIds,
    pastMeetingIds,
  };

  const contentsByLesson = new Map<string, OutlineContent[]>();
  for (const content of contents ?? []) {
    const rules = rulesByContentId.get(content.id) ?? [];
    const list = contentsByLesson.get(content.lesson_id) ?? [];
    list.push({
      id: content.id,
      title: content.title,
      type: content.type,
      classification: content.classification,
      estimatedMinutes: content.estimated_minutes,
      released: isContentReleased(rules, releaseContext),
      progressPercent: progressByContentId.get(content.id) ?? 0,
      completed: completedContentIds.has(content.id),
    });
    contentsByLesson.set(content.lesson_id, list);
  }

  const activitiesByLesson = new Map<string, OutlineActivity[]>();
  for (const activity of activities ?? []) {
    const list = activitiesByLesson.get(activity.lesson_id) ?? [];
    list.push({ id: activity.id, title: activity.title });
    activitiesByLesson.set(activity.lesson_id, list);
  }

  const lessonsByModule = new Map<string, OutlineLesson[]>();
  for (const lesson of lessons ?? []) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push({
      id: lesson.id,
      name: lesson.name,
      contents: contentsByLesson.get(lesson.id) ?? [],
      activities: activitiesByLesson.get(lesson.id) ?? [],
    });
    lessonsByModule.set(lesson.module_id, list);
  }

  return (modules ?? []).map((module_) => ({
    id: module_.id,
    name: module_.name,
    lessons: lessonsByModule.get(module_.id) ?? [],
  }));
}
