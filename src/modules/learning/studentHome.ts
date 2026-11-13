import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatSaoPauloLongDate, formatSaoPauloTimeRange, getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { buildMapsSearchUrl } from "@/lib/maps";
import { selectNextMeeting } from "./nextMeeting";
import { isReleaseActive, lateReleaseMessage, lateReleaseView } from "@/modules/assessment/lateRelease";
import { loadAttemptStats, loadExceptionalKeys, loadLateReleases } from "@/modules/assessment/lateReleaseQueries";

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
  kind: "assessment" | "late_request" | "meeting" | "study";
  label: string;
  /** Segunda linha do cartão (por exemplo, o nome da avaliação). */
  detail?: string | null;
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
      .select("id, title, type, season_volume_offering_id, closes_at, late_requests_until")
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

  // Prazo vencido esconde o aviso, a não ser que o aluno tenha liberação (24 horas) ou possa pedir uma.
  const enrollmentByOfferingId = new Map(rows.map((e) => [e.season_volume_offering_id, e]));
  const enrollmentIds = rows.map((e) => e.id);
  const assessmentIds = (openAssessments ?? []).map((a) => a.id);
  const [lateReleases, attemptStats, exceptionalKeys] = await Promise.all([
    loadLateReleases(supabase, enrollmentIds, assessmentIds),
    loadAttemptStats(supabase, enrollmentIds, assessmentIds),
    loadExceptionalKeys(supabase, enrollmentIds, assessmentIds),
  ]);
  const withView = (openAssessments ?? []).map((a) => {
    const enrollment = enrollmentByOfferingId.get(a.season_volume_offering_id);
    const key = enrollment ? `${a.id}:${enrollment.id}` : "";
    const releaseValidUntil = lateReleases.get(key) ?? null;
    const stats = attemptStats.get(key) ?? { used: 0, inProgress: false };
    const view = lateReleaseView({
      closesAt: a.closes_at,
      requestsUntil: a.late_requests_until,
      releaseValidUntil,
      attemptsUsed: stats.used,
      attemptsAllowed: exceptionalKeys.has(key) ? 2 : 1,
      hasInProgress: stats.inProgress,
    });
    // Prova em andamento mantém o atalho mesmo depois que a liberação venceu (ela continua valendo até o fim do tempo).
    const keepNotice = stats.inProgress;
    return {
      assessment: a,
      view,
      keepNotice,
      releaseUntil: view === "released" && isReleaseActive(releaseValidUntil) ? releaseValidUntil : null,
    };
  });
  const firstOpen = withView.find((x) => x.view === "none" || x.view === "released" || x.keepNotice) ?? null;
  const firstRequest = withView.find((x) => x.view === "request" && x.assessment.type === "final") ?? null;

  const nextStep: StudentNextStep | null = firstOpen
    ? firstOpen.releaseUntil
      ? {
          kind: "assessment",
          label: lateReleaseMessage(firstOpen.releaseUntil),
          detail: firstOpen.assessment.title,
          href: `/avaliacoes/${firstOpen.assessment.id}`,
        }
      : {
          kind: "assessment",
          label: `Você tem uma avaliação em aberto: ${firstOpen.assessment.title}`,
          href: `/avaliacoes/${firstOpen.assessment.id}`,
        }
    : firstRequest
      ? {
          kind: "late_request",
          label: "Não conseguiu fazer a avaliação final?",
          detail: `${firstRequest.assessment.title}. Conte o motivo e a prova é liberada para você na hora.`,
          href: `/avaliacoes/${firstRequest.assessment.id}`,
        }
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
