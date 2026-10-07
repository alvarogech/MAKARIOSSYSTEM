import { formatRoom } from "@/lib/room";
import { loadReportActiveByClass } from "@/modules/teaching/reportSettingsLoader";
import { isMeetingOver } from "@/modules/teaching/reportSettings";
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
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { toProgressCredits, type CreditRow } from "@/modules/attendance/credits";
import { computeProgress, formatHours } from "@/modules/attendance/progress";
import { SITUATION } from "@/modules/attendance/situation";
import { describeFrequency } from "@/modules/attendance/studentFrequency";

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

  const [{ data: offering }, { data: meetings }, { data: roster }, { data: creditRows }, { data: reports }] =
    await Promise.all([
      supabase
        .from("season_volume_offerings")
        .select("volume_id")
        .eq("id", klass.season_volume_offering_id)
        .single(),
      supabase
        .from("class_meetings")
        .select("id, sequence, meeting_date, end_time, academic_minutes, status, room")
        .eq("class_id", classId)
        .order("sequence"),
      // Lista única da turma (matriculados + aprovados que ainda vão criar a conta) e as presenças
      // de cada um — as mesmas funções da coordenação, então os números batem.
      supabase.rpc("class_roster", { p_class_id: classId }),
      supabase.rpc("attendance_credits", { p_class_id: classId }),
      supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", authContext.userId),
    ]);

  const todayKey = getSaoPauloDateKey(new Date());
  const meetingInfos = (meetings ?? [])
    .filter((m) => m.status !== "canceled")
    .map((m) => ({ id: m.id, minutes: m.academic_minutes, past: Boolean(m.meeting_date && m.meeting_date < todayKey) }));
  const creditsByPerson = new Map<string, CreditRow[]>();
  for (const row of (creditRows ?? []) as (CreditRow & { person_key: string })[]) {
    creditsByPerson.set(row.person_key, [...(creditsByPerson.get(row.person_key) ?? []), row]);
  }
  const students = (roster ?? []).map((person) => {
    const progress = computeProgress(meetingInfos, toProgressCredits(creditsByPerson.get(person.person_key) ?? []));
    return { person, progress, view: describeFrequency(progress) };
  });

  const waitingCount = students.filter(({ person }) => person.stage === "aguardando_acesso").length;
  const activeCount = students.length - waitingCount;

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const reportedMeetingIds = new Set((reports ?? []).map((r) => r.meeting_id));

  const { data: blocks } = await supabase
    .from("class_meeting_blocks")
    .select("id, class_meeting_id, module_id, teacher_id, teacher_label, start_time, end_time, status")
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

  // Só os módulos que ELE dá nesta turma — nunca a biblioteca inteira do
  // volume. Uma turma pode ter vários professores, cada um numa matéria
  // diferente; mostrar tudo fazia parecer que ele era responsável por
  // temas que não são dele.
  const myModuleIds = [
    ...new Set(
      (blocks ?? [])
        .filter((b) => b.teacher_id === authContext.userId && b.module_id)
        .map((b) => b.module_id as string),
    ),
  ];
  const materials =
    offering && myModuleIds.length > 0
      ? await loadMaterials(supabase, { volumeId: offering.volume_id, moduleIds: myModuleIds })
      : { apostilas: [], slides: [] };

  const myMeetingCount = new Set(
    (blocks ?? []).filter((b) => b.teacher_id === authContext.userId).map((b) => b.class_meeting_id),
  ).size;
  const totalMeetingCount = (meetings ?? []).length;

  // Relatório pós-aula: só onde o semestre exige, no encontro em que sou escalado(a) e depois do término.
  const reportActive = (await loadReportActiveByClass(supabase, [classId])).get(classId) ?? false;
  const nowForReports = new Date();
  const myScheduledMeetingIds = new Set(
    (blocks ?? []).filter((b) => b.teacher_id === authContext.userId && b.status !== "canceled").map((b) => b.class_meeting_id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{klass.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {volume.data?.name ?? "Volume"} {classLocationLabel ? `· ${classLocationLabel}` : "· Local a confirmar"}
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Alunos</h2>
        <p className="mt-0.5 text-sm text-neutral-700">{activeCount} ativos{waitingCount > 0 ? ` · ${waitingCount} aguardando acesso` : ""}</p>
        <p className="mt-1 text-xs text-neutral-500">
          Inclui quem já tem matrícula e quem foi aprovado e ainda vai criar a conta. Frequência: horas cumpridas e situação em
          relação aos 75% exigidos.
        </p>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {students.map(({ person, progress, view }) => {
            const situation = SITUATION[progress.situation];
            return (
              <li key={person.person_key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-neutral-700">
                <span className="min-w-0">
                  {person.full_name}
                  {person.stage === "aguardando_acesso" ? (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">aguardando acesso</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">
                    {formatHours(progress.attendedMinutes)} de {formatHours(view.heldMinutes)} realizadas · {formatHours(progress.totalMinutes)} no total
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${situation.className}`} title={`Pode perder mais ${formatHours(view.progress.slackMinutes)}`}>
                    {situation.label}
                  </span>
                </span>
              </li>
            );
          })}
          {students.length === 0 ? <li className="py-1.5 text-neutral-400">Nenhum aluno nesta turma ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Encontros</h2>
        {totalMeetingCount > 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            Você está escalado(a) em {myMeetingCount} de {totalMeetingCount} encontros desta turma.
            Os demais aparecem abaixo só como contexto — cada um mostra o professor responsável.
          </p>
        ) : null}
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
                    {reportedMeetingIds.has(meeting.id) ? (
                      <span className="ml-2 text-xs text-success">relatório enviado</span>
                    ) : null}
                    {formatRoom(meeting.room) ? <span className="ml-2 text-xs text-neutral-400">· {formatRoom(meeting.room)}</span> : null}
                  </span>
                  {reportActive && myScheduledMeetingIds.has(meeting.id) && isMeetingOver(meeting.meeting_date, meeting.end_time, nowForReports) ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/professor/turmas/${classId}/encontros/${meeting.id}/relatorio`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        {reportedMeetingIds.has(meeting.id) ? "Ver relatório" : "Enviar relatório"}
                      </Link>
                    </div>
                  ) : null}
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
                            {isMine ? null : ` · ${block.teacher_id ? (blockTeacherNameById.get(block.teacher_id) ?? "Outro professor") : (block.teacher_label ?? "Professor a confirmar")}`}
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
        <h2 className="font-semibold text-neutral-900">Materiais das suas aulas nesta turma</h2>
        {myModuleIds.length > 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            Só os temas que você ministra aqui. Para o material completo de uma aula específica, abra
            &ldquo;Preparar aula&rdquo; a partir do encontro correspondente.
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            Você ainda não tem nenhuma aula definida nesta turma — assim que a coordenação te escalar
            em um encontro, os materiais aparecem aqui.
          </p>
        )}
        <MaterialsSection materials={materials} showModuleName />
      </Card>
    </div>
  );
}
