import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange } from "@/lib/saoPauloDate";
import { AssignLessonBlockForm } from "@/modules/academic/components/AssignLessonBlockForm";
import { DeleteLessonBlockButton } from "@/modules/academic/components/DeleteLessonBlockButton";

export const metadata: Metadata = { title: "Escala de aulas" };

export default async function ClassScheduleAdminPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, season_volume_offering_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass) {
    notFound();
  }

  const { data: offering } = await supabase
    .from("season_volume_offerings")
    .select("volume_id")
    .eq("id", klass.season_volume_offering_id)
    .maybeSingle();

  const [{ data: meetings }, { data: modules }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select("id, sequence, meeting_date, start_time, end_time")
      .eq("class_id", classId)
      .order("sequence"),
    offering
      ? supabase.from("modules").select("id, name").eq("volume_id", offering.volume_id).order("order_index")
      : Promise.resolve({ data: [] }),
  ]);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const { data: blocks } = await supabase
    .from("class_meeting_blocks")
    .select("id, class_meeting_id, module_id, teacher_id, start_time, end_time, order_index, status, coordination_notes")
    .in("class_meeting_id", meetingIds)
    .order("order_index");

  const blockTeacherIds = [...new Set((blocks ?? []).map((b) => b.teacher_id).filter((id): id is string => Boolean(id)))];
  const { data: teacherProfiles } = blockTeacherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", blockTeacherIds)
    : { data: [] };
  const teacherNameById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.full_name]));
  const moduleNameById = new Map((modules ?? []).map((m) => [m.id, m.name]));

  const blocksByMeeting = new Map<string, NonNullable<typeof blocks>>();
  for (const block of blocks ?? []) {
    const list = blocksByMeeting.get(block.class_meeting_id) ?? [];
    list.push(block);
    blocksByMeeting.set(block.class_meeting_id, list);
  }

  const meetingOptions = (meetings ?? []).map((meeting) => ({
    id: meeting.id,
    label: meeting.meeting_date
      ? `${formatSaoPauloLongDate(meeting.meeting_date)} (encontro ${meeting.sequence})`
      : `Encontro ${meeting.sequence} — data a definir`,
  }));

  const nextOrderIndexByMeeting: Record<string, number> = {};
  for (const meeting of meetings ?? []) {
    const existing = blocksByMeeting.get(meeting.id) ?? [];
    nextOrderIndexByMeeting[meeting.id] = existing.length + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Escala de aulas — {klass.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Defina o tema, o professor e o horário de cada bloco dentro de um encontro. Enquanto um
          encontro não tiver nenhum bloco, os professores vinculados à turma veem apenas
          &ldquo;escala ainda não definida&rdquo;.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Encontros e blocos cadastrados</h2>
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
          {(meetings ?? []).map((meeting) => {
            const meetingBlocks = blocksByMeeting.get(meeting.id) ?? [];
            return (
              <li key={meeting.id} className="py-3">
                <p className="font-medium text-neutral-700">
                  {meeting.meeting_date ? formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true }) : `Encontro ${meeting.sequence} — data a definir`}
                </p>
                {meetingBlocks.length === 0 ? (
                  <p className="mt-1 text-xs text-neutral-400">Nenhum bloco cadastrado ainda.</p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {meetingBlocks.map((block) => (
                      <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 pl-3 text-sm text-neutral-600">
                        <span>
                          {formatSaoPauloTimeRange(block.start_time, block.end_time)} ·{" "}
                          {block.module_id ? (moduleNameById.get(block.module_id) ?? "Tema a definir") : "Tema a definir"} ·{" "}
                          {block.teacher_id ? (teacherNameById.get(block.teacher_id) ?? "Professor") : "Professor a definir"}
                          {block.status !== "scheduled" ? ` · ${block.status === "changed" ? "alterada" : "cancelada"}` : ""}
                        </span>
                        <DeleteLessonBlockButton blockId={block.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {(meetings ?? []).length === 0 ? <li className="py-2 text-neutral-400">Nenhum encontro cadastrado para esta turma.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Adicionar aula à escala</h2>
        <div className="mt-4">
          <AssignLessonBlockForm
            meetings={meetingOptions}
            modules={(modules ?? []).map((m) => ({ id: m.id, name: m.name }))}
            nextOrderIndexByMeeting={nextOrderIndexByMeeting}
          />
        </div>
      </Card>
    </div>
  );
}
