import "server-only";

// Liberações já dadas, com nome do aluno e de quem liberou, para a lista da coordenação.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatReleaseDeadline, isReleaseActive } from "./lateRelease";

export interface LateReleaseRow {
  id: string;
  studentName: string;
  assessmentId: string;
  validUntilLabel: string;
  active: boolean;
  grantedByName: string;
  reason: string;
  source: "student" | "staff";
  requestedAtLabel: string;
  /** Se já fez a prova: "Já fez a prova, nota 7,5", "Prova em andamento" ou "Ainda não fez a prova". */
  attemptLabel: string;
}

function describeAttempt(list: { status: string; score: number | string | null }[]): string {
  const done = list.filter((a) => a.status === "submitted" || a.status === "expired");
  if (done.length > 0) {
    const best = Math.max(...done.map((a) => Number(a.score ?? 0)));
    return `Já fez a prova, nota ${best.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
  return list.length > 0 ? "Prova em andamento" : "Ainda não fez a prova";
}

export async function loadLateReleaseRows(supabase: SupabaseClient<Database>): Promise<LateReleaseRow[]> {
  const { data: releases } = await supabase
    .from("assessment_late_releases")
    .select("id, assessment_id, enrollment_id, valid_until, granted_by, reason, source, created_at")
    .order("valid_until", { ascending: false })
    .limit(100);
  if (!releases || releases.length === 0) return [];

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .in("id", releases.map((r) => r.enrollment_id));
  const studentByEnrollment = new Map((enrollments ?? []).map((e) => [e.id, e.student_id]));

  const profileIds = [...new Set([...(enrollments ?? []).map((e) => e.student_id), ...releases.map((r) => r.granted_by)])];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const { data: attempts } = await supabase
    .from("assessment_attempts")
    .select("assessment_id, enrollment_id, status, score, created_at")
    .in("enrollment_id", releases.map((r) => r.enrollment_id))
    .in("assessment_id", releases.map((r) => r.assessment_id))
    .order("created_at", { ascending: false });

  const now = new Date();
  return releases.map((r) => ({
    id: r.id,
    studentName: nameById.get(studentByEnrollment.get(r.enrollment_id) ?? "") ?? "Aluno",
    assessmentId: r.assessment_id,
    validUntilLabel: formatReleaseDeadline(r.valid_until),
    active: isReleaseActive(r.valid_until, now),
    grantedByName: nameById.get(r.granted_by) ?? "Coordenação",
    reason: r.reason,
    source: r.source === "student" ? "student" : "staff",
    requestedAtLabel: formatReleaseDeadline(r.created_at),
    attemptLabel: describeAttempt(
      (attempts ?? []).filter((a) => a.assessment_id === r.assessment_id && a.enrollment_id === r.enrollment_id),
    ),
  }));
}
