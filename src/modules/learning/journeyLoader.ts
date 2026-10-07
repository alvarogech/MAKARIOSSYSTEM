import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { VolumeFrequency } from "@/modules/attendance/studentFrequency";
import { buildVolumeJourney, type StageInput, type VolumeJourney } from "./journey";
import { loadVolumeOutline } from "./loadVolumeOutline";

type DB = SupabaseClient<Database>;

const ACTIVE = ["active", "regularization", "approved"] as const;

/** Estado da matéria no calendário da turma, a partir das aulas (horas) que levam o nome dela. */
function meetingFor(frequency: VolumeFrequency | undefined, moduleName: string): StageInput["meeting"] {
  if (!frequency) return null;
  for (const meeting of frequency.meetings) {
    const lessons = meeting.lessons.filter((l) => l.subject === moduleName);
    if (lessons.length === 0) continue;
    const held = lessons.filter((l) => l.status !== "futuro");
    if (held.length === 0) return { date: meeting.date, past: false, attendance: "futuro" };
    const present = held.some((l) => l.status === "presente" || l.status === "autodeclarada" || l.status === "reposicao" || l.status === "atraso");
    return { date: meeting.date, past: true, attendance: present ? "presente" : "sem_registro" };
  }
  return null;
}

/**
 * Jornada de cada matrícula ativa do aluno. Roda com a sessão do aluno: tudo o que ele não pode ver
 * (conteúdo não publicado, gabarito, notas de outros) já não chega pelo banco.
 */
export async function loadStudentJourneys(supabase: DB, studentId: string, frequency: VolumeFrequency[]): Promise<VolumeJourney[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, class_id, season_volume_offering_id")
    .eq("student_id", studentId)
    .in("status", ACTIVE)
    .order("created_at", { ascending: false });
  if (!enrollments || enrollments.length === 0) return [];

  const offeringIds = [...new Set(enrollments.map((e) => e.season_volume_offering_id))];
  const { data: offerings } = await supabase.from("season_volume_offerings").select("id, volume_id").in("id", offeringIds);
  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];
  const { data: volumes } = volumeIds.length ? await supabase.from("volumes").select("id, name").in("id", volumeIds) : { data: [] };
  const volumeIdByOffering = new Map((offerings ?? []).map((o) => [o.id, o.volume_id]));
  const volumeNameById = new Map((volumes ?? []).map((v) => [v.id, v.name]));

  const journeys: VolumeJourney[] = [];
  for (const enrollment of enrollments) {
    const volumeId = volumeIdByOffering.get(enrollment.season_volume_offering_id);
    if (!volumeId) continue;

    const outline = await loadVolumeOutline(supabase, enrollment.id, volumeId);
    const lessonIds = outline.flatMap((m) => m.lessons.map((l) => l.id));
    const [{ data: attempts }, { data: challenges }, { data: completions }] = await Promise.all([
      supabase.from("activity_attempts").select("activity_id, status").eq("enrollment_id", enrollment.id),
      lessonIds.length
        ? supabase.from("practice_challenges").select("id, lesson_id").eq("status", "published").in("lesson_id", lessonIds)
        : Promise.resolve({ data: [] as { id: string; lesson_id: string }[] }),
      supabase.from("challenge_completions").select("challenge_id").eq("enrollment_id", enrollment.id),
    ]);
    const completedChallenges = new Set((completions ?? []).map((c) => c.challenge_id));
    const classFrequency = frequency.find((f) => f.classId === enrollment.class_id);

    const stages: StageInput[] = outline.map((module_) => {
      const contents = module_.lessons.flatMap((l) => l.contents);
      const activity = module_.lessons.flatMap((l) => l.activities)[0];
      const lessonIdsOfModule = new Set(module_.lessons.map((l) => l.id));
      const challenge = (challenges ?? []).find((c) => lessonIdsOfModule.has(c.lesson_id));
      const own = activity ? (attempts ?? []).filter((a) => a.activity_id === activity.id) : [];

      return {
        moduleId: module_.id,
        name: module_.name,
        meeting: meetingFor(classFrequency, module_.name),
        material: {
          total: contents.length,
          released: contents.filter((c) => c.released).length,
          completed: contents.filter((c) => c.completed).length,
        },
        fixation: activity
          ? {
              activityId: activity.id,
              status: own.some((a) => a.status === "submitted") ? "enviada" : own.some((a) => a.status === "in_progress") ? "em_andamento" : "nenhuma",
            }
          : null,
        practice: challenge ? { done: completedChallenges.has(challenge.id) } : null,
      };
    });

    journeys.push(buildVolumeJourney({ enrollmentId: enrollment.id, volumeName: volumeNameById.get(volumeId) ?? "Volume", stages }));
  }
  return journeys;
}
