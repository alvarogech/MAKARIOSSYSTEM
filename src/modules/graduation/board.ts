import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MIN_ATTENDANCE_RATIO } from "@/modules/attendance/progress";
import type { EditionStatus, InviteConflict } from "./ceremony";
import { inviteConflicts } from "./ceremony";
import { evaluateStudent } from "./eligibility";
import { loadStudentFacts } from "./facts";
import type { BoardRow, ContactStatus, FollowUpView, ParticipantView } from "./boardView";
import type { AttendanceFact, OverallStatus } from "./types";

type DB = SupabaseClient<Database>;

export interface EditionView {
  id: string;
  name: string;
  seasonId: string;
  seasonName: string;
  status: EditionStatus;
  eventName: string | null;
  eventDate: string | null;
  eventTime: string | null;
  locationName: string | null;
  address: string | null;
  instructions: string | null;
  rsvpDeadline: string | null;
  inviteMessage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

const EDITION_COLUMNS =
  "id, name, season_id, status, event_name, event_date, event_time, location_name, address, instructions, rsvp_deadline, invite_message, published_at, updated_at, created_at";

type EditionRecord = Database["public"]["Tables"]["graduation_editions"]["Row"];

function toEditionView(row: Pick<EditionRecord, keyof EditionRecord>, seasonName: string): EditionView {
  return {
    id: row.id,
    name: row.name,
    seasonId: row.season_id,
    seasonName,
    status: row.status as EditionStatus,
    eventName: row.event_name,
    eventDate: row.event_date,
    eventTime: row.event_time?.slice(0, 5) ?? null,
    locationName: row.location_name,
    address: row.address,
    instructions: row.instructions,
    rsvpDeadline: row.rsvp_deadline,
    inviteMessage: row.invite_message,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function loadEditions(supabase: DB): Promise<EditionView[]> {
  const [{ data: rows }, { data: seasons }] = await Promise.all([
    supabase.from("graduation_editions").select(EDITION_COLUMNS).order("created_at", { ascending: false }),
    supabase.from("seasons").select("id, name"),
  ]);
  const seasonName = new Map((seasons ?? []).map((s) => [s.id, s.name]));
  return (rows ?? []).map((r) => toEditionView(r as EditionRecord, seasonName.get(r.season_id) ?? "—"));
}

/** A edição escolhida na URL; sem escolha, a mais recente que não está arquivada. */
export function pickEdition(editions: EditionView[], requestedId: string | undefined): EditionView | null {
  return editions.find((e) => e.id === requestedId) ?? editions.find((e) => e.status !== "arquivada") ?? editions[0] ?? null;
}

function attendancePct(a: AttendanceFact | null): number | null {
  if (!a) return null;
  const base = a.allMeetingsPast ? a.totalMinutes : a.attendedMinutes + a.missedMinutes;
  return base > 0 ? Math.round((a.attendedMinutes / base) * 1000) / 10 : null;
}

export interface Board {
  rows: BoardRow[];
  computedAt: string;
  conflicts: InviteConflict[];
  /** Nome de quem pode ser responsável (coordenação/admin que já aparece nos acompanhamentos). */
  responsibles: { id: string; name: string }[];
}

/**
 * Candidatos de uma edição com a elegibilidade CALCULADA agora a partir dos
 * registros acadêmicos. Nada aqui é guardado: abrir a página já recalcula,
 * então o painel nunca mostra um resultado velho como se fosse definitivo.
 */
export async function loadBoard(supabase: DB, edition: EditionView, now: Date = new Date()): Promise<Board> {
  const [{ data: participants }, { data: followUps }, { data: contacts }] = await Promise.all([
    supabase
      .from("graduation_participants")
      .select(
        "id, student_id, added_reason, invited_at, invited_status, response, responded_at, response_source, response_channel, ceremony_attendance, certificate_name, certificate_name_checked_at",
      )
      .eq("edition_id", edition.id),
    supabase
      .from("graduation_follow_ups")
      .select("student_id, requirement_key, contact_status, responsible_id, next_step, due_date, notes, updated_at")
      .eq("edition_id", edition.id),
    supabase.from("graduation_contacts").select("student_id, contacted_at").eq("edition_id", edition.id).order("contacted_at", { ascending: false }),
  ]);

  const list = participants ?? [];
  const facts = await loadStudentFacts(supabase, list.map((p) => p.student_id), now);

  const responsibleIds = [...new Set((followUps ?? []).map((f) => f.responsible_id).filter((x): x is string => !!x))];
  const { data: responsibleProfiles } = responsibleIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", responsibleIds)
    : { data: [] as { id: string; full_name: string }[] };
  const responsibleName = new Map((responsibleProfiles ?? []).map((p) => [p.id, p.full_name]));

  const followUpView = (f: NonNullable<typeof followUps>[number]): FollowUpView => ({
    requirementKey: f.requirement_key,
    contactStatus: f.contact_status as ContactStatus,
    responsibleId: f.responsible_id,
    responsibleName: f.responsible_id ? (responsibleName.get(f.responsible_id) ?? null) : null,
    nextStep: f.next_step,
    dueDate: f.due_date,
    notes: f.notes,
    updatedAt: f.updated_at,
  });

  const lastContact = new Map<string, string>();
  for (const c of contacts ?? []) if (!lastContact.has(c.student_id)) lastContact.set(c.student_id, c.contacted_at);

  const rows: BoardRow[] = [];
  const status = new Map<string, OverallStatus>();
  for (const p of list) {
    const f = facts.get(p.student_id);
    if (!f) continue;
    const evaluation = evaluateStudent(f, { now, minAttendanceRatio: MIN_ATTENDANCE_RATIO });
    status.set(p.student_id, evaluation.overall);
    const mine = (followUps ?? []).filter((x) => x.student_id === p.student_id).map(followUpView);
    const voz = evaluation.modules.find((m) => m.slug === "voz");
    const vozEnrollment = f.enrollments.filter((e) => e.volume === "voz").sort((a, b) => b.seasonStartsOn.localeCompare(a.seasonStartsOn))[0];
    const participant: ParticipantView = {
      id: p.id,
      invitedAt: p.invited_at,
      invitedStatus: p.invited_status,
      response: p.response as ParticipantView["response"],
      respondedAt: p.responded_at,
      responseSource: p.response_source as ParticipantView["responseSource"],
      responseChannel: p.response_channel,
      ceremonyAttendance: p.ceremony_attendance as ParticipantView["ceremonyAttendance"],
      certificateName: p.certificate_name,
      certificateNameCheckedAt: p.certificate_name_checked_at,
      addedReason: p.added_reason,
    };
    rows.push({
      studentId: p.student_id,
      requestId: f.requestId,
      name: f.fullName,
      email: f.email,
      phone: f.phone,
      className: vozEnrollment?.className ?? null,
      seasonName: vozEnrollment?.seasonName ?? null,
      evaluation,
      vozAttendancePct: attendancePct(voz?.attendance ?? null),
      vozGrade: voz?.grade ?? null,
      participant,
      followUp: mine.find((x) => x.requirementKey === "geral") ?? null,
      requirementFollowUps: mine.filter((x) => x.requirementKey !== "geral"),
      lastContactAt: lastContact.get(p.student_id) ?? null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const conflicts = inviteConflicts(
    rows.map((r) => ({ studentId: r.studentId, invitedAt: r.participant.invitedAt, invitedStatus: r.participant.invitedStatus, response: r.participant.response })),
    status,
  );

  return {
    rows,
    computedAt: now.toISOString(),
    conflicts,
    responsibles: responsibleIds.map((id) => ({ id, name: responsibleName.get(id) ?? "—" })),
  };
}
