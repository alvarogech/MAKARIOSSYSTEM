import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface AssignableLesson {
  blockId: string;
  classId: string;
  className: string;
  volumeName: string;
  moduleName: string;
  meetingDate: string;
}

/**
 * Aulas (class_meeting_blocks) ainda sem professor — a lista que a
 * coordenação usa para dizer exatamente QUAIS matérias a pessoa vai dar,
 * não só em qual turma ela está. Sem isso, um convite só vinculava a turma
 * inteira e o painel do professor (que só mostra aula com
 * class_meeting_blocks.teacher_id = ele) ficava vazio até alguém preencher
 * isso manualmente depois.
 */
export async function loadAssignableLessons(
  supabase: SupabaseClient<Database>,
): Promise<AssignableLesson[]> {
  const { data: blocks } = await supabase
    .from("class_meeting_blocks")
    .select(
      "id, module_id, class_meetings(class_id, meeting_date, classes(name, season_volume_offerings(volumes(name))))",
    )
    .is("teacher_id", null)
    .order("order_index");

  const { data: modules } = await supabase.from("modules").select("id, name");
  const moduleNameById = new Map((modules ?? []).map((m) => [m.id, m.name]));

  const lessons: AssignableLesson[] = [];
  for (const block of blocks ?? []) {
    const meeting = block.class_meetings as unknown as {
      class_id: string;
      meeting_date: string | null;
      classes: { name: string; season_volume_offerings: { volumes: { name: string } | null } | null } | null;
    } | null;
    if (!meeting?.classes) continue;

    lessons.push({
      blockId: block.id,
      classId: meeting.class_id,
      className: meeting.classes.name,
      volumeName: meeting.classes.season_volume_offerings?.volumes?.name ?? "Volume",
      moduleName: block.module_id ? (moduleNameById.get(block.module_id) ?? "Aula") : "Aula",
      meetingDate: meeting.meeting_date ?? "",
    });
  }

  lessons.sort((a, b) => {
    if (a.volumeName !== b.volumeName) return a.volumeName.localeCompare(b.volumeName);
    if (a.className !== b.className) return a.className.localeCompare(b.className);
    return a.meetingDate.localeCompare(b.meetingDate);
  });

  return lessons;
}
