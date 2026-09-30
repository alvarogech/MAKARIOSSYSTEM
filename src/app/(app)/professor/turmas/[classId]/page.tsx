import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadMaterials } from "@/modules/teaching/loadMaterials";
import { MaterialsSection } from "@/modules/teaching/components/MaterialsSection";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange } from "@/lib/saoPauloDate";

export const metadata: Metadata = { title: "Turma" };

export default async function ProfessorTurmaDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", authContext.userId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assignment) {
    notFound();
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, location, location_id, season_volume_offering_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass) {
    notFound();
  }

  const { data: classLocation } = klass.location_id
    ? await supabase.from("locations").select("name, address").eq("id", klass.location_id).maybeSingle()
    : { data: null };
  const classLocationLabel = classLocation
    ? classLocation.address
      ? `${classLocation.name} — ${classLocation.address}`
      : classLocation.name
    : klass.location;

  const [{ data: offering }, { data: meetings }, { data: enrollments }, { data: reports }] =
    await Promise.all([
      supabase
        .from("season_volume_offerings")
        .select("volume_id")
        .eq("id", klass.season_volume_offering_id)
        .single(),
      supabase
        .from("class_meetings")
        .select("id, sequence, meeting_date, academic_minutes, status, room")
        .eq("class_id", classId)
        .order("sequence"),
      supabase
        .from("enrollments")
        .select("id, student_id, status")
        .eq("class_id", classId),
      supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", authContext.userId),
    ]);

  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const { data: attendanceCounts } = await supabase
    .from("attendance_records")
    .select("meeting_id")
    .in("meeting_id", meetingIds);
  const recordedMeetingIds = new Set((attendanceCounts ?? []).map((a) => a.meeting_id));
  const reportedMeetingIds = new Set((reports ?? []).map((r) => r.meeting_id));

  const { data: blocks } = await supabase
    .from("class_meeting_blocks")
    .select("id, class_meeting_id, module_id, teacher_id, start_time, end_time, status")
    .in("class_meeting_id", meetingIds)
    .order("order_index");

  const blockModuleIds = [...new Set((blocks ?? []).map((b) => b.module_id).filter((id): id is string => Boolean(id)))];
  const blockTeacherIds = [...new Set((blocks ?? []).map((b) => b.teacher_id).filter((id): id is string => Boolean(id)))];
  const [{ data: blockModules }, { data: blockTeachers }] = await Promise.all([
    blockModuleIds.length ? supabase.from("modules").select("id, name").in("id", blockModuleIds) : Promise.resolve({ data: [] }),
    blockTeacherIds.length ? supabase.from("profiles").select("id, full_name").in("id", blockTeacherIds) : Promise.resolve({ data: [] }),
  ]);
  const blockModuleNameById = new Map((blockModules ?? []).map((m) => [m.id, m.name]));
  const blockTeacherNameById = new Map((blockTeachers ?? []).map((p) => [p.id, p.full_name]));
  const blocksByMeeting = new Map<string, NonNullable<typeof blocks>>();
  for (const block of blocks ?? []) {
    const list = blocksByMeeting.get(block.class_meeting_id) ?? [];
    list.push(block);
    blocksByMeeting.set(block.class_meeting_id, list);
  }

  const volume = offering
    ? await supabase.from("volumes").select("name").eq("id", offering.volume_id).maybeSingle()
    : { data: null };

  const materials = offering
    ? await loadMaterials(supabase, { volumeId: offering.volume_id })
    : { apostilas: [], slides: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{klass.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {volume.data?.name ?? "Volume"} {classLocationLabel ? `· ${classLocationLabel}` : "· Local a confirmar"}
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Alunos ({(enrollments ?? []).length})</h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {(enrollments ?? []).map((enrollment) => (
            <li key={enrollment.id} className="py-1.5 text-neutral-700">
              {profilesById.get(enrollment.student_id)?.full_name ?? "Aluno"}{" "}
              <span className="text-neutral-400">({enrollment.status})</span>
            </li>
          ))}
          {(enrollments ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum aluno matriculado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Encontros</h2>
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
          {(meetings ?? []).map((meeting) => {
            const meetingBlocks = blocksByMeeting.get(meeting.id) ?? [];
            return (
              <li key={meeting.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-700">
                    {meeting.meeting_date
                      ? formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true })
                      : `Encontro ${meeting.sequence} — data a definir`}
                    {meeting.status === "canceled" ? (
                      <span className="ml-2 text-xs font-semibold uppercase text-danger">Cancelado</span>
                    ) : null}
                    {recordedMeetingIds.has(meeting.id) ? (
                      <span className="ml-2 text-xs text-success">frequência registrada</span>
                    ) : null}
                    {reportedMeetingIds.has(meeting.id) ? (
                      <span className="ml-2 text-xs text-success">relatório enviado</span>
                    ) : null}
                    {meeting.room ? <span className="ml-2 text-xs text-neutral-400">· {meeting.room}</span> : null}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/professor/turmas/${classId}/encontros/${meeting.id}/frequencia`}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Frequência
                    </Link>
                    <Link
                      href={`/professor/turmas/${classId}/encontros/${meeting.id}/relatorio`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Relatório
                    </Link>
                  </div>
                </div>

                {meetingBlocks.length === 0 ? (
                  <p className="mt-1.5 text-xs text-neutral-400">
                    Encontro da turma — sua escala ainda não foi definida pela coordenação.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {meetingBlocks.map((block) => {
                      const isMine = block.teacher_id === authContext.userId;
                      return (
                        <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 pl-3 text-sm">
                          <span className={isMine ? "text-neutral-700" : "text-neutral-400"}>
                            {formatSaoPauloTimeRange(block.start_time, block.end_time)} ·{" "}
                            {block.module_id ? (blockModuleNameById.get(block.module_id) ?? "Tema a definir") : "Tema a definir"}
                            {isMine ? null : ` · ${block.teacher_id ? (blockTeacherNameById.get(block.teacher_id) ?? "Outro professor") : "Professor a confirmar"}`}
                            {block.status === "canceled" ? " · cancelada" : block.status === "changed" ? " · alterada" : ""}
                          </span>
                          {isMine ? (
                            <Link href={`/professor/aulas/${block.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                              Preparar aula
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
          {(meetings ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum encontro cadastrado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Materiais do módulo</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Biblioteca completa do volume desta turma. Para os materiais de uma aula específica, abra
          &ldquo;Preparar aula&rdquo; a partir do encontro correspondente.
        </p>
        <MaterialsSection materials={materials} showModuleName />
      </Card>
    </div>
  );
}
