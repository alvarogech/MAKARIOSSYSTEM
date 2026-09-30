import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MeetingBlockStatus } from "@/integrations/supabase/types";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { buildMapsSearchUrl } from "@/lib/maps";
import { selectNextLesson } from "./nextLesson";
import { detectScheduleConflicts, type ScheduleBlockInterval, type ScheduleConflict } from "./scheduleConflicts";

export interface TeacherLesson {
  blockId: string;
  meetingId: string;
  classId: string;
  className: string;
  volumeName: string;
  moduleName: string | null;
  meetingDateKey: string | null;
  dateLabel: string | null;
  timeLabel: string;
  /** Horário bruto ("HH:MM:SS" ou vazio) só para ordenação — não exibir. */
  sortStartTime: string;
  sortEndTime: string;
  blockStatus: MeetingBlockStatus;
  meetingStatus: string;
  room: string | null;
  locationLabel: string | null;
  mapsUrl: string | null;
  canExportCalendar: boolean;
  isToday: boolean;
  isHappeningNow: boolean;
}

export interface TeacherMeetingAwaitingSchedule {
  meetingId: string;
  classId: string;
  className: string;
  volumeName: string;
  dateLabel: string | null;
  timeLabel: string;
}

export interface TeacherClassCard {
  classId: string;
  className: string;
  volumeName: string;
  seasonName: string;
  scheduleLabel: string | null;
  locationLabel: string | null;
  studentCount: number;
  nextLesson: TeacherLesson | null;
}

export interface TeacherAnnouncement {
  id: string;
  title: string;
  body: string;
  publishedLabel: string;
  scopeLabel: string;
}

export interface TeacherHomeSummary {
  nextLesson: TeacherLesson | null;
  todayOtherLessons: TeacherLesson[];
  upcomingLessons: TeacherLesson[];
  meetingsAwaitingSchedule: TeacherMeetingAwaitingSchedule[];
  classes: TeacherClassCard[];
  announcements: TeacherAnnouncement[];
  conflicts: ScheduleConflict[];
}

function locationLabelFor(
  location: { name: string; address: string | null } | undefined,
  legacyText: string | null,
): string | null {
  if (location) return location.address ? `${location.name} — ${location.address}` : location.name;
  return legacyText;
}

function mapsUrlFor(
  location: { name: string; address: string | null } | undefined,
  legacyText: string | null,
): string | null {
  const query = location ? (location.address ?? location.name) : legacyText;
  return query ? buildMapsSearchUrl(query) : null;
}

/**
 * Monta o resumo da home do professor: próxima aula EFETIVAMENTE atribuída
 * (nunca inferida do vínculo de turma), outras aulas do mesmo dia, próximas
 * aulas, encontros de turmas vinculadas que ainda não têm escala por bloco
 * definida, cards de turma e avisos relevantes. "Próxima aula" e conflitos
 * de escala usam sempre `class_meeting_blocks` (a agenda operacional), nunca
 * `teacher_assignments` (que é só vínculo/permissão).
 */
export async function loadTeacherHomeSummary(
  supabase: SupabaseClient<Database>,
  teacherId: string,
): Promise<TeacherHomeSummary> {
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("class_id")
    .eq("teacher_id", teacherId);

  const classIds = [...new Set((assignments ?? []).map((a) => a.class_id))];
  if (classIds.length === 0) {
    return {
      nextLesson: null,
      todayOtherLessons: [],
      upcomingLessons: [],
      meetingsAwaitingSchedule: [],
      classes: [],
      announcements: [],
      conflicts: [],
    };
  }

  const [{ data: classRows }, { data: meetings }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, location, location_id, season_volume_offering_id, class_template_id")
      .in("id", classIds),
    supabase
      .from("class_meetings")
      .select("id, class_id, meeting_date, start_time, end_time, status, location, location_id, room")
      .in("class_id", classIds)
      .order("sequence"),
  ]);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const templateIds = [...new Set((classRows ?? []).map((c) => c.class_template_id))];
  const offeringIds = [...new Set((classRows ?? []).map((c) => c.season_volume_offering_id))];
  const classLocationIds = [...new Set((classRows ?? []).map((c) => c.location_id).filter((id): id is string => Boolean(id)))];
  const meetingLocationIds = [...new Set((meetings ?? []).map((m) => m.location_id).filter((id): id is string => Boolean(id)))];

  // `.in(...)` com array vazio é seguro no supabase-js (retorna 0 linhas,
  // não erro) — evitamos os condicionais `length ? query : Promise.resolve`
  // aqui de propósito, porque misturar os dois formatos num mesmo
  // `Promise.all` faz o TypeScript colapsar o tipo da linha para `never`.
  const [
    { data: blocks },
    { data: templates },
    { data: offerings },
    { data: enrollments },
  ] = await Promise.all([
    supabase
      .from("class_meeting_blocks")
      .select("id, class_meeting_id, module_id, teacher_id, start_time, end_time, room, status, coordination_notes, order_index")
      .in("class_meeting_id", meetingIds)
      .order("order_index"),
    supabase.from("class_templates").select("id, name, start_time, end_time").in("id", templateIds),
    supabase.from("season_volume_offerings").select("id, season_id, volume_id").in("id", offeringIds),
    supabase.from("enrollments").select("id, class_id").in("class_id", classIds),
  ]);

  const moduleIds = [...new Set((blocks ?? []).map((b) => b.module_id).filter((id): id is string => Boolean(id)))];
  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];
  const seasonIds = [...new Set((offerings ?? []).map((o) => o.season_id))];
  const locationIds = [...new Set([...classLocationIds, ...meetingLocationIds])];

  const [{ data: modules }, { data: volumes }, { data: seasons }, { data: locations }, { data: announcementsRaw }] =
    await Promise.all([
      supabase.from("modules").select("id, name").in("id", moduleIds),
      supabase.from("volumes").select("id, name").in("id", volumeIds),
      supabase.from("seasons").select("id, name").in("id", seasonIds),
      supabase.from("locations").select("id, name, address").in("id", locationIds),
      supabase
        .from("announcements")
        .select("id, title, body, class_id, module_id, published_at")
        .order("published_at", { ascending: false })
        .limit(30),
    ]);

  const classById = new Map((classRows ?? []).map((c) => [c.id, c]));
  const templateById = new Map((templates ?? []).map((t) => [t.id, t]));
  const offeringById = new Map((offerings ?? []).map((o) => [o.id, o]));
  const volumeNameById = new Map((volumes ?? []).map((v) => [v.id, v.name]));
  const seasonNameById = new Map((seasons ?? []).map((s) => [s.id, s.name]));
  const moduleNameById = new Map((modules ?? []).map((m) => [m.id, m.name]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));
  const blocksByMeeting = new Map<string, NonNullable<typeof blocks>>();
  for (const block of blocks ?? []) {
    const list = blocksByMeeting.get(block.class_meeting_id) ?? [];
    list.push(block);
    blocksByMeeting.set(block.class_meeting_id, list);
  }
  const studentCountByClass = new Map<string, number>();
  for (const enrollment of enrollments ?? []) {
    studentCountByClass.set(enrollment.class_id, (studentCountByClass.get(enrollment.class_id) ?? 0) + 1);
  }

  const now = new Date();
  const todayKey = getSaoPauloDateKey(now);
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);

  function volumeNameForClass(classId: string): string {
    const klass = classById.get(classId);
    const offering = klass ? offeringById.get(klass.season_volume_offering_id) : undefined;
    return offering ? (volumeNameById.get(offering.volume_id) ?? "Volume") : "Volume";
  }

  function toLesson(meeting: NonNullable<typeof meetings>[number], block: NonNullable<typeof blocks>[number]): TeacherLesson {
    const klass = classById.get(meeting.class_id);
    const location = meeting.location_id
      ? locationById.get(meeting.location_id)
      : klass?.location_id
        ? locationById.get(klass.location_id)
        : undefined;
    const legacyLocation = meeting.location ?? klass?.location ?? null;
    const startTime = block.start_time ?? meeting.start_time ?? "";
    const endTime = block.end_time ?? meeting.end_time ?? "";
    const isToday = meeting.meeting_date === todayKey;
    const isHappeningNow = isToday && Boolean(startTime) && Boolean(endTime) && startTime <= nowTime && nowTime < endTime;

    return {
      blockId: block.id,
      meetingId: meeting.id,
      classId: meeting.class_id,
      className: klass?.name ?? "Turma",
      volumeName: volumeNameForClass(meeting.class_id),
      moduleName: block.module_id ? (moduleNameById.get(block.module_id) ?? null) : null,
      meetingDateKey: meeting.meeting_date,
      dateLabel: meeting.meeting_date ? formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true }) : null,
      timeLabel: formatSaoPauloTimeRange(startTime || null, endTime || null),
      sortStartTime: startTime,
      sortEndTime: endTime,
      blockStatus: block.status,
      meetingStatus: meeting.status,
      room: block.room ?? meeting.room ?? null,
      locationLabel: locationLabelFor(location, legacyLocation),
      mapsUrl: mapsUrlFor(location, legacyLocation),
      canExportCalendar: Boolean(meeting.meeting_date && startTime && endTime),
      isToday,
      isHappeningNow,
    };
  }

  const myLessons: TeacherLesson[] = [];
  const meetingsAwaitingSchedule: TeacherMeetingAwaitingSchedule[] = [];

  for (const meeting of meetings ?? []) {
    const meetingBlocks = blocksByMeeting.get(meeting.id) ?? [];
    if (meetingBlocks.length === 0) {
      if (meeting.meeting_date && meeting.meeting_date >= todayKey && meeting.status !== "canceled") {
        const klass = classById.get(meeting.class_id);
        meetingsAwaitingSchedule.push({
          meetingId: meeting.id,
          classId: meeting.class_id,
          className: klass?.name ?? "Turma",
          volumeName: volumeNameForClass(meeting.class_id),
          dateLabel: formatSaoPauloLongDate(meeting.meeting_date, { capitalize: true }),
          timeLabel: formatSaoPauloTimeRange(meeting.start_time, meeting.end_time),
        });
      }
      continue;
    }
    for (const block of meetingBlocks) {
      if (block.teacher_id === teacherId) {
        myLessons.push(toLesson(meeting, block));
      }
    }
  }

  const nextLessonRaw = selectNextLesson(
    myLessons.map((l) => ({ meetingDateKey: l.meetingDateKey, startTime: l.sortStartTime, blockStatus: l.blockStatus, meetingStatus: l.meetingStatus, ref: l })),
    todayKey,
  )?.ref ?? null;

  const upcomingSorted = myLessons
    .filter((l) => l.meetingDateKey && l.meetingDateKey >= todayKey && l.blockStatus !== "canceled" && l.meetingStatus !== "canceled")
    .sort((a, b) => {
      if (a.meetingDateKey !== b.meetingDateKey) return (a.meetingDateKey ?? "") < (b.meetingDateKey ?? "") ? -1 : 1;
      return a.sortStartTime.localeCompare(b.sortStartTime);
    });

  const todayOtherLessons = nextLessonRaw
    ? myLessons.filter(
        (l) => l.meetingDateKey === nextLessonRaw.meetingDateKey && l.blockId !== nextLessonRaw.blockId && l.blockStatus !== "canceled",
      )
    : [];

  const upcomingLessons = nextLessonRaw
    ? upcomingSorted.filter((l) => l.meetingDateKey !== nextLessonRaw.meetingDateKey)
    : upcomingSorted;

  const classCards: TeacherClassCard[] = (classRows ?? []).map((klass) => {
    const offering = offeringById.get(klass.season_volume_offering_id);
    const template = templateById.get(klass.class_template_id);
    const location = klass.location_id ? locationById.get(klass.location_id) : undefined;
    const classLessons = myLessons
      .filter((l) => l.classId === klass.id && l.meetingDateKey && l.meetingDateKey >= todayKey && l.blockStatus !== "canceled")
      .sort((a, b) => ((a.meetingDateKey ?? "") < (b.meetingDateKey ?? "") ? -1 : 1));

    return {
      classId: klass.id,
      className: klass.name,
      volumeName: offering ? (volumeNameById.get(offering.volume_id) ?? "Volume") : "Volume",
      seasonName: offering ? (seasonNameById.get(offering.season_id) ?? "Temporada") : "Temporada",
      scheduleLabel: template ? `${template.name} · ${formatSaoPauloTimeRange(template.start_time, template.end_time)}` : null,
      locationLabel: locationLabelFor(location, klass.location),
      studentCount: studentCountByClass.get(klass.id) ?? 0,
      nextLesson: classLessons[0] ?? null,
    };
  });

  const announcements: TeacherAnnouncement[] = (announcementsRaw ?? [])
    .filter((a) => a.class_id === null || classIds.includes(a.class_id) || (a.module_id && moduleIds.includes(a.module_id)))
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      publishedLabel: formatSaoPauloLongDate(a.published_at.slice(0, 10), { capitalize: true }),
      scopeLabel: a.class_id
        ? (classById.get(a.class_id)?.name ?? "Turma")
        : a.module_id
          ? (moduleNameById.get(a.module_id) ?? "Módulo")
          : "Geral",
    }));

  const conflictIntervals: ScheduleBlockInterval[] = myLessons
    .filter((l): l is TeacherLesson & { meetingDateKey: string } => Boolean(l.meetingDateKey))
    .map((l) => {
      const meeting = (meetings ?? []).find((m) => m.id === l.meetingId);
      const block = (blocks ?? []).find((b) => b.id === l.blockId);
      const start = block?.start_time ?? meeting?.start_time ?? null;
      const end = block?.end_time ?? meeting?.end_time ?? null;
      return start && end
        ? { id: l.blockId, dateKey: l.meetingDateKey, startTime: start, endTime: end, label: `${l.volumeName} — ${l.className}` }
        : null;
    })
    .filter((interval): interval is ScheduleBlockInterval => interval !== null);

  return {
    nextLesson: nextLessonRaw,
    todayOtherLessons,
    upcomingLessons,
    meetingsAwaitingSchedule,
    classes: classCards,
    announcements,
    conflicts: detectScheduleConflicts(conflictIntervals),
  };
}
