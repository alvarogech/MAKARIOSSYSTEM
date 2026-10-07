import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classTagLabel } from "@/lib/classLabel";
import { formatRoom } from "@/lib/room";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { toProgressCredits, type CreditRow } from "@/modules/attendance/credits";
import { computeProgress, formatHours } from "@/modules/attendance/progress";
import { SITUATION } from "@/modules/attendance/situation";
import { describeFrequency } from "@/modules/attendance/studentFrequency";
import { loadClassJourney } from "@/modules/learning/classJourney";
import { ClassJourneyPanel } from "@/modules/learning/components/ClassJourneyPanel";
import { MaterialsSection } from "@/modules/teaching/components/MaterialsSection";
import { StudentsList, type StudentRowView } from "@/modules/teaching/components/StudentsList";
import { loadMaterials } from "@/modules/teaching/loadMaterials";
import { isMeetingOver } from "@/modules/teaching/reportSettings";
import { loadReportActiveByClass } from "@/modules/teaching/reportSettingsLoader";
import { countdownLabel } from "@/modules/teaching/teacherDashboardLogic";

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
  // O endereço completo fica aqui, no detalhe da turma (os cards mostram só o local).
  const classLocationLabel = classLocation
    ? classLocation.address
      ? `${classLocation.name} — ${classLocation.address}`
      : classLocation.name
    : klass.location;

  const now = new Date();
  const todayKey = getSaoPauloDateKey(now);

  const [{ data: offering }, { data: meetings }, { data: roster }, { data: creditRows }, { data: reports }, journey] =
    await Promise.all([
      supabase.from("season_volume_offerings").select("volume_id").eq("id", klass.season_volume_offering_id).single(),
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
      loadClassJourney(supabase, classId),
    ]);

  const meetingInfos = (meetings ?? [])
    .filter((m) => m.status !== "canceled")
    .map((m) => ({ id: m.id, minutes: m.academic_minutes, past: Boolean(m.meeting_date && m.meeting_date < todayKey) }));
  const creditsByPerson = new Map<string, CreditRow[]>();
  for (const row of (creditRows ?? []) as (CreditRow & { person_key: string })[]) {
    creditsByPerson.set(row.person_key, [...(creditsByPerson.get(row.person_key) ?? []), row]);
  }
  const studentRows: StudentRowView[] = (roster ?? [])
    .map((person) => {
      const progress = computeProgress(meetingInfos, toProgressCredits(creditsByPerson.get(person.person_key) ?? []));
      const view = describeFrequency(progress);
      const situation = SITUATION[progress.situation];
      return {
        key: person.person_key,
        name: person.full_name,
        waiting: person.stage === "aguardando_acesso",
        hoursLabel: `${formatHours(progress.attendedMinutes)} de ${formatHours(view.heldMinutes)} realizadas · ${formatHours(progress.totalMinutes)} no total`,
        attention: progress.situation !== "em_dia",
        situationLabel: situation.label,
        situationClass: situation.className,
        situationTitle: `Pode perder mais ${formatHours(view.progress.slackMinutes)}`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

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

  const volume = offering ? await supabase.from("volumes").select("name").eq("id", offering.volume_id).maybeSingle() : { data: null };
  const volumeName = volume.data?.name ?? "Volume";

  // Só os módulos que ELE dá nesta turma — nunca a biblioteca inteira do volume.
  const myModuleIds = [
    ...new Set((blocks ?? []).filter((b) => b.teacher_id === authContext.userId && b.module_id).map((b) => b.module_id as string)),
  ];
  const materials =
    offering && myModuleIds.length > 0
      ? await loadMaterials(supabase, { volumeId: offering.volume_id, moduleIds: myModuleIds })
      : { apostilas: [], slides: [] };

  const myMeetingCount = new Set((blocks ?? []).filter((b) => b.teacher_id === authContext.userId).map((b) => b.class_meeting_id)).size;
  const totalMeetingCount = (meetings ?? []).length;

  // Relatório pós-aula: só onde o semestre exige, no encontro em que sou escalado(a) e depois do término.
  const reportActive = (await loadReportActiveByClass(supabase, [classId])).get(classId) ?? false;
  const myScheduledMeetingIds = new Set(
    (blocks ?? []).filter((b) => b.teacher_id === authContext.userId && b.status !== "canceled").map((b) => b.class_meeting_id),
  );

  // Próximo encontro MEU: primeiro bloco meu, não cancelado, que ainda não terminou.
  const meetingById = new Map((meetings ?? []).map((m) => [m.id, m]));
  const nextMine = (blocks ?? [])
    .filter((b) => b.teacher_id === authContext.userId && b.status !== "canceled")
    .map((b) => ({ block: b, meeting: meetingById.get(b.class_meeting_id) }))
    .filter(
      (x): x is { block: NonNullable<typeof blocks>[number]; meeting: NonNullable<typeof x.meeting> } =>
        Boolean(x.meeting?.meeting_date) && x.meeting!.status !== "canceled" && !isMeetingOver(x.meeting!.meeting_date, x.block.end_time ?? x.meeting!.end_time, now),
    )
    .sort((a, b) => `${a.meeting.meeting_date}${a.block.start_time ?? ""}`.localeCompare(`${b.meeting.meeting_date}${b.block.start_time ?? ""}`))[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{classTagLabel(volumeName, klass.name)}</h1>
        <p className="mt-0.5 text-sm text-neutral-500">{classLocationLabel ?? "Local a confirmar"}</p>
      </div>

      {/* 1. Próximo encontro do professor */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Seu próximo encontro</p>
        {nextMine ? (
          <>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
              {nextMine.block.module_id ? (blockModuleNameById.get(nextMine.block.module_id) ?? "Tema a definir") : "Tema a definir"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {formatSaoPauloLongDate(nextMine.meeting.meeting_date!, { capitalize: true })} ·{" "}
              {formatSaoPauloTimeRange(nextMine.block.start_time, nextMine.block.end_time)}
              {formatRoom(nextMine.meeting.room) ? ` · ${formatRoom(nextMine.meeting.room)}` : ""}
            </p>
            <p className="mt-1 text-sm text-neutral-500">{countdownLabel(nextMine.meeting.meeting_date!, nextMine.block.start_time, todayKey)}</p>
            <Link href={`/professor/aulas/${nextMine.block.id}`} className={`${buttonVariants({ variant: "primary", size: "sm" })} mt-3 inline-flex`}>
              Abrir material e preparar
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-neutral-600">Nenhuma aula sua nesta turma por enquanto. Os encontros abaixo mostram a escala completa.</p>
        )}
      </Card>

      {/* 2. Encontros: os dele em destaque, os demais esmaecidos e sem ações */}
      <Card>
        <h2 className="font-semibold text-neutral-900">Encontros</h2>
        {totalMeetingCount > 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            Você está escalado(a) em {myMeetingCount} de {totalMeetingCount} encontros. Os demais aparecem esmaecidos, só como contexto, com o professor responsável.
          </p>
        ) : null}
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
          {(meetings ?? []).map((meeting) => {
            const meetingBlocks = blocksByMeeting.get(meeting.id) ?? [];
            const mine = meetingBlocks.some((b) => b.teacher_id === authContext.userId);
            const canReport =
              reportActive && myScheduledMeetingIds.has(meeting.id) && isMeetingOver(meeting.meeting_date, meeting.end_time, now);
            return (
              <li key={meeting.id} className={`py-3 ${mine ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${mine ? "font-semibold text-neutral-900" : "font-medium text-neutral-600"}`}>
                    {meeting.meeting_date
                      ? formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true })
                      : `Encontro ${meeting.sequence} — data a definir`}
                    {meeting.status === "canceled" ? <span className="ml-2 text-xs font-semibold uppercase text-danger">Cancelado</span> : null}
                    {reportedMeetingIds.has(meeting.id) ? <span className="ml-2 text-xs font-normal text-success">relatório enviado</span> : null}
                    {formatRoom(meeting.room) ? <span className="ml-2 text-xs font-normal text-neutral-400">· {formatRoom(meeting.room)}</span> : null}
                  </span>
                  {canReport ? (
                    <Link href={`/professor/turmas/${classId}/encontros/${meeting.id}/relatorio`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      {reportedMeetingIds.has(meeting.id) ? "Ver relatório" : "Enviar relatório"}
                    </Link>
                  ) : null}
                </div>

                {meetingBlocks.length === 0 ? (
                  <p className="mt-1.5 text-xs text-neutral-500">Encontro da turma — a escala ainda não foi definida pela coordenação.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {meetingBlocks.map((block) => {
                      const isMine = block.teacher_id === authContext.userId;
                      return (
                        <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 pl-3 text-sm">
                          <span className={isMine ? "text-neutral-800" : "text-neutral-500"}>
                            {formatSaoPauloTimeRange(block.start_time, block.end_time)} ·{" "}
                            {block.module_id ? (blockModuleNameById.get(block.module_id) ?? "Tema a definir") : "Tema a definir"}
                            {isMine
                              ? null
                              : ` · ${block.teacher_id ? (blockTeacherNameById.get(block.teacher_id) ?? "Outro professor") : (block.teacher_label ?? "Professor a confirmar")}`}
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
          {(meetings ?? []).length === 0 ? <li className="py-1.5 text-neutral-500">Nenhum encontro cadastrado ainda.</li> : null}
        </ul>
      </Card>

      {/* 3. Materiais */}
      <Card>
        <h2 className="font-semibold text-neutral-900">Materiais das suas aulas nesta turma</h2>
        {myModuleIds.length > 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            Só os temas que você ministra aqui. Para o material completo de uma aula específica, abra &ldquo;Preparar aula&rdquo; no encontro correspondente.
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            Você ainda não tem aula definida nesta turma — assim que a coordenação te escalar em um encontro, os materiais aparecem aqui.
          </p>
        )}
        <MaterialsSection materials={materials} showModuleName />
      </Card>

      {/* Jornada da turma: só agregados */}
      <ClassJourneyPanel journey={journey} />

      {/* 4. Alunos */}
      <StudentsList students={studentRows} />
    </div>
  );
}
