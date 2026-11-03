import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MIN_ATTENDANCE_RATIO } from "@/modules/attendance/progress";
import { rsvpWindow, type EditionStatus, type RsvpWindow } from "./ceremony";
import { evaluateStudent } from "./eligibility";
import { loadStudentFacts } from "./facts";
import type { ModuleResult } from "./types";

type DB = SupabaseClient<Database>;

export const DEFAULT_INVITE_MESSAGE =
  "Parabéns pela conclusão da sua jornada na Escola Makários! Estamos organizando nossa cerimônia de formatura e queremos saber se você estará conosco.";

export interface StudentInvitation {
  editionId: string;
  editionName: string;
  eventName: string | null;
  eventDate: string | null;
  eventTime: string | null;
  locationName: string | null;
  address: string | null;
  instructions: string | null;
  inviteMessage: string;
  rsvpDeadline: string | null;
  response: "sem_resposta" | "confirmado" | "nao_comparece";
  window: RsvpWindow;
}

/**
 * Convite do próprio aluno. Roda com a sessão dele: o banco só devolve a edição
 * se ela estiver publicada E ele tiver sido convidado (RLS), então um aluno sem
 * convite recebe `null`, nunca dados da cerimônia.
 */
export async function loadStudentInvitation(supabase: DB, studentId: string, now: Date = new Date()): Promise<StudentInvitation | null> {
  const { data: participants } = await supabase
    .from("graduation_participants")
    .select("edition_id, response, invited_at")
    .eq("student_id", studentId)
    .not("invited_at", "is", null);
  if (!participants || participants.length === 0) return null;

  const { data: editions } = await supabase
    .from("graduation_editions")
    .select("id, name, status, event_name, event_date, event_time, location_name, address, instructions, invite_message, rsvp_deadline, published_at")
    .in("id", participants.map((p) => p.edition_id))
    .not("published_at", "is", null)
    .neq("status", "arquivada")
    .order("created_at", { ascending: false })
    .limit(1);
  const edition = editions?.[0];
  if (!edition) return null;
  const participant = participants.find((p) => p.edition_id === edition.id)!;

  return {
    editionId: edition.id,
    editionName: edition.name,
    eventName: edition.event_name,
    eventDate: edition.event_date,
    eventTime: edition.event_time?.slice(0, 5) ?? null,
    locationName: edition.location_name,
    address: edition.address,
    instructions: edition.instructions,
    inviteMessage: edition.invite_message?.trim() || DEFAULT_INVITE_MESSAGE,
    rsvpDeadline: edition.rsvp_deadline,
    response: participant.response as StudentInvitation["response"],
    window: rsvpWindow({ status: edition.status as EditionStatus, publishedAt: edition.published_at, rsvpDeadline: edition.rsvp_deadline }, now),
  };
}

export interface StudentJourneyModule {
  slug: string;
  label: string;
  status: ModuleResult["status"];
  seasonName: string | null;
}

/**
 * Andamento por módulo para o próprio aluno, calculado com a sessão dele. É um
 * resumo de plataforma: não diz "apto" nem mostra motivos internos (a conferência
 * de histórico e de cadastro é da coordenação e o aluno não enxerga esses dados).
 */
export async function loadStudentJourney(supabase: DB, studentId: string): Promise<StudentJourneyModule[]> {
  try {
    const facts = (await loadStudentFacts(supabase, [studentId])).get(studentId);
    if (!facts) return [];
    const evaluation = evaluateStudent(facts, { now: new Date(), minAttendanceRatio: MIN_ATTENDANCE_RATIO });
    return evaluation.modules.map((m) => ({ slug: m.slug, label: m.label, status: m.status, seasonName: m.seasonName }));
  } catch {
    return [];
  }
}
