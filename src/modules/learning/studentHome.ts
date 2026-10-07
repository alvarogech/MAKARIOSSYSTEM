import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { buildMapsSearchUrl } from "@/lib/maps";
import { selectNextMeeting } from "./nextMeeting";

const ACTIVE_ENROLLMENT_STATUSES = ["active", "regularization", "approved"] as const;

export interface StudentNextMeeting {
  id: string;
  volumeName: string;
  className: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  mapsUrl: string | null;
  volumeHref: string;
}

export interface StudentNextStep {
  kind: "assessment" | "meeting" | "study";
  label: string;
  href: string | null;
}

export interface StudentVolumeCard {
  enrollmentId: string;
  volumeName: string;
  seasonName: string;
  status: string;
  /** Convite do grupo de WhatsApp do volume — só chega para quem está matriculado nele (RLS). */
  whatsappGroupUrl: string | null;
}

export interface StudentHomeSummary {
  nextMeeting: StudentNextMeeting | null;
  otherUpcomingCount: number;
  nextStep: StudentNextStep | null;
  volumes: StudentVolumeCard[];
}

/**
 * Monta o resumo do painel inicial do aluno: próximo encontro (entre todas
 * as turmas matriculadas), próximo passo sugerido e a lista de volumes.
 * "Próximo passo" segue uma cascata determinística — nunca IA — na ordem:
 * avaliação em aberto > próximo encontro > continuar estudando > nada.
 */
export async function loadStudentHomeSummary(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<StudentHomeSummary> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, class_id, status, season_volume_offering_id")
    .eq("student_id", studentId)
    .in("status", ACTIVE_ENROLLMENT_STATUSES)
    .order("created_at", { ascending: false });

  const rows = enrollments ?? [];
  if (rows.length === 0) {
    return { nextMeeting: null, otherUpcomingCount: 0, nextStep: null, volumes: [] };
  }

  const classIds = [...new Set(rows.map((e) => e.class_id))];
  const offeringIds = [...new Set(rows.map((e) => e.season_volume_offering_id))];

  const [{ data: classes }, { data: offerings }, { data: meetings }] = await Promise.all([
    supabase.from("classes").select("id, name, location").in("id", classIds),
    supabase.from("season_volume_offerings").select("id, season_id, volume_id").in("id", offeringIds),
    supabase
      .from("class_meetings")
      .select("id, class_id, meeting_date, start_time, end_time")
      .in("class_id", classIds)
      .not("meeting_date", "is", null),
  ]);

  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];
  const seasonIds = [...new Set((offerings ?? []).map((o) => o.season_id))];
  const [{ data: volumes }, { data: seasons }, { data: openAssessments }, { data: whatsappGroups }] = await Promise.all([
    supabase.from("volumes").select("id, name").in("id", volumeIds),
    supabase.from("seasons").select("id, name").in("id", seasonIds),
    supabase
      .from("assessments")
      .select("id, title, season_volume_offering_id")
      .in("season_volume_offering_id", offeringIds)
      .eq("status", "open"),
    supabase.from("volume_whatsapp_groups").select("volume_id, invite_url").in("volume_id", volumeIds),
  ]);

  const whatsappUrlByVolumeId = new Map((whatsappGroups ?? []).map((g) => [g.volume_id, g.invite_url]));
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));
  const offeringById = new Map((offerings ?? []).map((o) => [o.id, o]));
  const volumeNameById = new Map((volumes ?? []).map((v) => [v.id, v.name]));
  const seasonNameById = new Map((seasons ?? []).map((s) => [s.id, s.name]));
  const enrollmentByClassId = new Map(rows.map((e) => [e.class_id, e]));

  const todayKey = getSaoPauloDateKey(new Date());

  const meetingCandidates = (meetings ?? [])
    .filter((m): m is typeof m & { meeting_date: string } => Boolean(m.meeting_date))
    .map((m) => ({
      id: m.id,
      classId: m.class_id,
      meetingDateKey: m.meeting_date,
      startTime: m.start_time,
      endTime: m.end_time,
    }));

  const upcoming = meetingCandidates
    .filter((m) => m.meetingDateKey >= todayKey)
    .sort((a, b) =>
      a.meetingDateKey !== b.meetingDateKey
        ? a.meetingDateKey < b.meetingDateKey
          ? -1
          : 1
        : (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );

  const nextRaw = selectNextMeeting(meetingCandidates, todayKey);

  let nextMeeting: StudentNextMeeting | null = null;
  if (nextRaw) {
    const klass = classById.get(nextRaw.classId);
    const enrollment = enrollmentByClassId.get(nextRaw.classId);
    const offering = enrollment ? offeringById.get(enrollment.season_volume_offering_id) : undefined;
    const volumeName = offering ? (volumeNameById.get(offering.volume_id) ?? "Volume") : "Volume";

    nextMeeting = {
      id: nextRaw.id,
      volumeName,
      className: klass?.name ?? "Turma",
      dateLabel: formatSaoPauloLongDate(nextRaw.meetingDateKey, { capitalize: true }),
      timeLabel: formatSaoPauloTimeRange(nextRaw.startTime, nextRaw.endTime),
      location: klass?.location ?? null,
      mapsUrl: klass?.location ? buildMapsSearchUrl(klass.location) : null,
      volumeHref: enrollment ? `/meus-volumes/${enrollment.id}` : "/meus-volumes",
    };
  }

  const otherUpcomingCount = nextMeeting ? Math.max(0, upcoming.length - 1) : 0;

  const firstOpenAssessment = (openAssessments ?? [])[0] ?? null;

  const nextStep: StudentNextStep | null = firstOpenAssessment
    ? { kind: "assessment", label: `Você tem uma avaliação em aberto: ${firstOpenAssessment.title}`, href: `/avaliacoes/${firstOpenAssessment.id}` }
    : nextMeeting
      ? {
          kind: "meeting",
          label: `Seu próximo passo é participar do encontro de ${nextMeeting.className} em ${nextMeeting.dateLabel}.`,
          href: nextMeeting.volumeHref,
        }
      : rows[0]
        ? { kind: "study", label: "Continue seus estudos nos volumes em andamento.", href: `/meus-volumes/${rows[0].id}` }
        : null;

  const volumesCards: StudentVolumeCard[] = rows.map((enrollment) => {
    const offering = offeringById.get(enrollment.season_volume_offering_id);
    return {
      enrollmentId: enrollment.id,
      volumeName: offering ? (volumeNameById.get(offering.volume_id) ?? "Volume") : "Volume",
      seasonName: offering ? (seasonNameById.get(offering.season_id) ?? "Temporada") : "Temporada",
      status: enrollment.status,
      whatsappGroupUrl: offering ? (whatsappUrlByVolumeId.get(offering.volume_id) ?? null) : null,
    };
  });

  return { nextMeeting, otherUpcomingCount, nextStep, volumes: volumesCards };
}
