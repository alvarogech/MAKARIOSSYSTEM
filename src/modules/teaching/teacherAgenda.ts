import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { buildMapsSearchUrl } from "@/lib/maps";
import type { TeacherLesson, TeacherMeetingAwaitingSchedule } from "./teacherHome";

export interface AgendaFilterOption {
  id: string;
  name: string;
}

export interface TeacherAgendaData {
  lessons: TeacherLesson[];
  meetingsAwaitingSchedule: TeacherMeetingAwaitingSchedule[];
  classOptions: AgendaFilterOption[];
  moduleOptions: AgendaFilterOption[];
}

/**
 * Todas as aulas (passadas e futuras) do professor, para a Agenda — ao
 * contrário de `loadTeacherHomeSummary`, não filtra por data, porque
 * encontros passados continuam disponíveis para consulta (seção 5 do
 * pedido de redesenho).
 */
export async function loadTeacherAgenda(
  supabase: SupabaseClient<Database>,
  teacherId: string,
): Promise<TeacherAgendaData> {
  const { data: assignments } = await supabase.from("teacher_assignments").select("class_id").eq("teacher_id", teacherId);
  const classIds = [...new Set((assignments ?? []).map((a) => a.class_id))];

  if (classIds.length === 0) {
    return { lessons: [], meetingsAwaitingSchedule: [], classOptions: [], moduleOptions: [] };
  }

  const [{ data: classRows }, { data: meetings }] = await Promise.all([
    supabase.from("classes").select("id, name, location, location_id, season_volume_offering_id").in("id", classIds),
    supabase
      .from("class_meetings")
      .select("id, class_id, meeting_date, start_time, end_time, status, location, location_id, room")
      .in("class_id", classIds)
      .order("meeting_date", { ascending: true }),
  ]);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const offeringIds = [...new Set((classRows ?? []).map((c) => c.season_volume_offering_id))];
  const classLocationIds = [...new Set((classRows ?? []).map((c) => c.location_id).filter((id): id is string => Boolean(id)))];
  const meetingLocationIds = [...new Set((meetings ?? []).map((m) => m.location_id).filter((id): id is string => Boolean(id)))];

  const [{ data: blocks }, { data: offerings }] = await Promise.all([
    supabase
      .from("class_meeting_blocks")
      .select("id, class_meeting_id, module_id, teacher_id, start_time, end_time, room, status, coordination_notes, order_index")
      .in("class_meeting_id", meetingIds)
      .order("order_index"),
    supabase.from("season_volume_offerings").select("id, season_id, volume_id").in("id", offeringIds),
  ]);

  const moduleIds = [...new Set((blocks ?? []).map((b) => b.module_id).filter((id): id is string => Boolean(id)))];
  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];
  const locationIds = [...new Set([...classLocationIds, ...meetingLocationIds])];

  const [{ data: modules }, { data: volumes }, { data: locations }] = await Promise.all([
    supabase.from("modules").select("id, name").in("id", moduleIds),
    supabase.from("volumes").select("id, name").in("id", volumeIds),
    supabase.from("locations").select("id, name, address").in("id", locationIds),
  ]);

  const classById = new Map((classRows ?? []).map((c) => [c.id, c]));
  const offeringById = new Map((offerings ?? []).map((o) => [o.id, o]));
  const volumeNameById = new Map((volumes ?? []).map((v) => [v.id, v.name]));
  const moduleNameById = new Map((modules ?? []).map((m) => [m.id, m.name]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));
  const blocksByMeeting = new Map<string, NonNullable<typeof blocks>>();
  for (const block of blocks ?? []) {
    const list = blocksByMeeting.get(block.class_meeting_id) ?? [];
    list.push(block);
    blocksByMeeting.set(block.class_meeting_id, list);
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

  function locationLabelFor(location: { name: string; address: string | null } | undefined, legacyText: string | null): string | null {
    if (location) return location.address ? `${location.name} — ${location.address}` : location.name;
    return legacyText;
  }

  function mapsUrlFor(location: { name: string; address: string | null } | undefined, legacyText: string | null): string | null {
    const query = location ? (location.address ?? location.name) : legacyText;
    return query ? buildMapsSearchUrl(query) : null;
  }

  const lessons: TeacherLesson[] = [];
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
      if (block.teacher_id !== teacherId) continue;

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

      lessons.push({
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
        isHappeningNow: isToday && Boolean(startTime) && Boolean(endTime) && startTime <= nowTime && nowTime < endTime,
      });
    }
  }

  lessons.sort((a, b) => {
    if (a.meetingDateKey !== b.meetingDateKey) return (a.meetingDateKey ?? "") < (b.meetingDateKey ?? "") ? -1 : 1;
    return a.sortStartTime.localeCompare(b.sortStartTime);
  });

  const classOptions: AgendaFilterOption[] = (classRows ?? []).map((c) => ({ id: c.id, name: c.name }));
  const moduleOptions: AgendaFilterOption[] = [...moduleNameById.entries()].map(([id, name]) => ({ id, name }));

  return { lessons, meetingsAwaitingSchedule, classOptions, moduleOptions };
}
