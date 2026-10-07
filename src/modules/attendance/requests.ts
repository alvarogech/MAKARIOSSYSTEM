import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { VolumeFrequency } from "./studentFrequency";

type DB = SupabaseClient<Database>;

export interface RequestableMeeting {
  meetingId: string;
  volumeName: string;
  sequence: number;
  date: string;
  start: string;
  end: string;
  /** Aulas sem presença registrada (as que fazem sentido pedir). */
  missing: { number: number; start: string; end: string; subject: string | null }[];
}

export interface OwnRequest {
  id: string;
  meetingId: string;
  label: string;
  lessons: number[];
  justification: string;
  status: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  createdAt: string;
}

/** Encontros em que o aluno pode pedir presença + os pedidos que ele já fez. */
export async function loadStudentRequests(
  supabase: DB,
  studentId: string,
  volumes: VolumeFrequency[],
): Promise<{ requestable: RequestableMeeting[]; own: OwnRequest[] }> {
  const { data: rows } = await supabase
    .from("attendance_requests")
    .select("id, meeting_id, lessons, justification, status, decision_note, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  const requested = new Set((rows ?? []).map((r) => r.meeting_id));
  const meetingLabel = new Map<string, string>();
  const requestable: RequestableMeeting[] = [];

  for (const volume of volumes) {
    for (const meeting of volume.meetings) {
      meetingLabel.set(meeting.id, `${volume.volumeName}, encontro ${meeting.sequence}`);
      const missing = meeting.lessons.filter((l) => l.status === "ausente" || l.status === "atraso");
      if (missing.length === 0 || requested.has(meeting.id)) continue;
      requestable.push({
        meetingId: meeting.id,
        volumeName: volume.volumeName,
        sequence: meeting.sequence,
        date: meeting.date,
        start: meeting.start,
        end: meeting.end,
        missing: missing.map((l) => ({ number: l.number, start: l.start, end: l.end, subject: l.subject })),
      });
    }
  }

  return {
    requestable,
    own: (rows ?? []).map((r) => ({
      id: r.id,
      meetingId: r.meeting_id,
      label: meetingLabel.get(r.meeting_id) ?? "Encontro",
      lessons: [...r.lessons].sort((a, b) => a - b),
      justification: r.justification,
      status: r.status as OwnRequest["status"],
      decisionNote: r.decision_note,
      createdAt: r.created_at,
    })),
  };
}
