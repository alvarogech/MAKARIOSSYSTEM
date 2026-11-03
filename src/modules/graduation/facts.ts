import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSaoPauloDateKey } from "@/lib/saoPauloDate";
import { toProgressCredits, type CreditRow } from "@/modules/attendance/credits";
import { loadAttendanceCredits } from "@/modules/attendance/creditsLoader";
import { computeProgress } from "@/modules/attendance/progress";
import { toMinutes } from "@/modules/attendance/rules";
import {
  MODULES,
  type AssessmentFact,
  type AttemptFact,
  type DuplicateSuspect,
  type EnrollmentFact,
  type HistoryRecordFact,
  type ModuleSlug,
  type StudentFacts,
} from "./types";

type DB = SupabaseClient<Database>;

/** O PostgREST limita o tamanho da URL: listas grandes de ids vão em lotes. */
const CHUNK = 60;

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function inBatches<Row>(ids: readonly string[], run: (batch: string[]) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const rows: Row[] = [];
  for (const batch of chunks([...new Set(ids)])) {
    const { data, error } = await run(batch);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}

function nowMinuteSaoPaulo(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

const isModule = (slug: string): slug is ModuleSlug => (MODULES as readonly string[]).includes(slug);

/** Mesma noção de nome da inscrição: sem acento, minúsculo, espaços únicos. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lê do banco, com a sessão da coordenação, tudo o que o motor de
 * elegibilidade precisa para cada aluno. Não decide nada: só monta os fatos.
 */
export async function loadStudentFacts(supabase: DB, studentIds: readonly string[], now: Date = new Date()): Promise<Map<string, StudentFacts>> {
  const ids = [...new Set(studentIds)];
  const result = new Map<string, StudentFacts>();
  if (ids.length === 0) return result;

  const [profiles, requests, enrollments, history, pendingRequests, pendingDeclarations] = await Promise.all([
    inBatches(ids, (b) => supabase.from("profiles").select("id, full_name, email, phone").in("id", b)),
    inBatches(ids, (b) =>
      supabase
        .from("enrollment_requests")
        .select("id, student_id, full_name, email, phone, cpf_hash, prerequisite_declaration, created_at")
        .in("student_id", b)
        .order("created_at", { ascending: false }),
    ),
    inBatches(ids, (b) =>
      supabase.from("enrollments").select("id, student_id, season_volume_offering_id, class_id, status, final_grade, updated_at").in("student_id", b),
    ),
    inBatches(ids, (b) =>
      supabase
        .from("graduation_history_records")
        .select("id, student_id, volume_slug, season_label, origin, evidence, validated_by, validated_at")
        .in("student_id", b)
        .is("revoked_at", null),
    ),
    inBatches(ids, (b) => supabase.from("attendance_requests").select("student_id").in("student_id", b).eq("status", "pending")),
    inBatches(ids, (b) => supabase.from("attendance_declarations").select("student_id").in("student_id", b).eq("status", "pending")),
  ]);

  const offeringIds = enrollments.map((e) => e.season_volume_offering_id);
  const classIds = enrollments.map((e) => e.class_id);
  const enrollmentIds = enrollments.map((e) => e.id);
  const validatorIds = history.map((h) => h.validated_by);
  const cpfHashes = requests.map((r) => r.cpf_hash);
  const emails = profiles.map((p) => p.email?.toLowerCase()).filter((e): e is string => !!e);

  const [offerings, classes, meetings, assessments, attempts, eligible, grants, validators, sameCpf, sameEmail] = await Promise.all([
    inBatches(offeringIds, (b) => supabase.from("season_volume_offerings").select("id, season_id, volume_id").in("id", b)),
    inBatches(classIds, (b) => supabase.from("classes").select("id, name").in("id", b)),
    inBatches(classIds, (b) =>
      supabase.from("class_meetings").select("id, class_id, meeting_date, end_time, academic_minutes").in("class_id", b).neq("status", "canceled").not("meeting_date", "is", null),
    ),
    inBatches(offeringIds, (b) =>
      supabase.from("assessments").select("id, season_volume_offering_id, type, status, passing_grade, closes_at").in("season_volume_offering_id", b),
    ),
    inBatches(enrollmentIds, (b) =>
      supabase.from("assessment_attempts").select("assessment_id, enrollment_id, status, score, submitted_at, deadline_at").in("enrollment_id", b),
    ),
    inBatches(enrollmentIds, (b) => supabase.from("assessment_eligible_students").select("assessment_id, enrollment_id").in("enrollment_id", b)),
    inBatches(enrollmentIds, (b) => supabase.from("assessment_exceptional_grants").select("assessment_id, enrollment_id").in("enrollment_id", b)),
    inBatches(validatorIds, (b) => supabase.from("profiles").select("id, full_name").in("id", b)),
    inBatches(cpfHashes, (b) => supabase.from("enrollment_requests").select("id, student_id, full_name, cpf_hash, status").in("cpf_hash", b).in("status", ["approved", "pending"])),
    inBatches(emails, (b) => supabase.from("profiles").select("id, full_name, email").in("email", b).eq("is_demo", false)),
  ]);

  const [{ data: seasonRows }, { data: volumeRows }] = await Promise.all([
    supabase.from("seasons").select("id, name, starts_on"),
    supabase.from("volumes").select("id, slug"),
  ]);
  const seasonById = new Map((seasonRows ?? []).map((s) => [s.id, s]));
  const volumeSlugById = new Map((volumeRows ?? []).map((v) => [v.id, v.slug]));
  const offeringById = new Map(offerings.map((o) => [o.id, o]));
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const validatorName = new Map(validators.map((v) => [v.id, v.full_name]));

  // Frequência: a mesma função e as mesmas regras da tela do aluno e da ficha.
  const requestByStudent = new Map<string, (typeof requests)[number]>();
  for (const r of requests) if (r.student_id && !requestByStudent.has(r.student_id)) requestByStudent.set(r.student_id, r);

  const creditsByKey = new Map<string, CreditRow[]>();
  for (const batch of chunks(ids, 40)) {
    const keys = batch.flatMap((id) => {
      const req = requestByStudent.get(id);
      return req ? [`s:${id}`, `r:${req.id}`] : [`s:${id}`];
    });
    const rows = await loadAttendanceCredits(supabase, { personKeys: keys });
    for (const row of rows) creditsByKey.set(row.person_key, [...(creditsByKey.get(row.person_key) ?? []), row as CreditRow]);
  }

  const today = getSaoPauloDateKey(now);
  const nowMinute = nowMinuteSaoPaulo(now);
  const meetingsByClass = new Map<string, typeof meetings>();
  for (const m of meetings) meetingsByClass.set(m.class_id, [...(meetingsByClass.get(m.class_id) ?? []), m]);

  const assessmentsByOffering = new Map<string, typeof assessments>();
  for (const a of assessments) assessmentsByOffering.set(a.season_volume_offering_id, [...(assessmentsByOffering.get(a.season_volume_offering_id) ?? []), a]);

  const attemptsByKey = new Map<string, AttemptFact[]>();
  for (const a of attempts) {
    const key = `${a.assessment_id}:${a.enrollment_id}`;
    attemptsByKey.set(key, [
      ...(attemptsByKey.get(key) ?? []),
      {
        status: a.status as AttemptFact["status"],
        score: a.score === null ? null : Number(a.score),
        submittedAt: a.submitted_at,
        deadlineAt: a.deadline_at,
      },
    ]);
  }
  const eligibleKeys = new Set(eligible.map((e) => `${e.assessment_id}:${e.enrollment_id}`));
  const grantKeys = new Set(grants.map((g) => `${g.assessment_id}:${g.enrollment_id}`));

  function assessmentFact(row: (typeof assessments)[number], enrollmentId: string): AssessmentFact {
    const key = `${row.id}:${enrollmentId}`;
    return {
      assessmentId: row.id,
      type: row.type as AssessmentFact["type"],
      status: row.status as AssessmentFact["status"],
      passingGrade: Number(row.passing_grade),
      closesAt: row.closes_at,
      eligible: eligibleKeys.has(key),
      attempts: attemptsByKey.get(key) ?? [],
      extraAttemptGranted: grantKeys.has(key),
    };
  }

  const pendingCount = new Map<string, number>();
  for (const row of [...pendingRequests, ...pendingDeclarations]) {
    if (row.student_id) pendingCount.set(row.student_id, (pendingCount.get(row.student_id) ?? 0) + 1);
  }

  for (const profile of profiles) {
    const request = requestByStudent.get(profile.id) ?? null;

    const enrollmentFacts: EnrollmentFact[] = [];
    for (const e of enrollments.filter((x) => x.student_id === profile.id)) {
      const offering = offeringById.get(e.season_volume_offering_id);
      const slug = offering ? volumeSlugById.get(offering.volume_id) : undefined;
      const season = offering ? seasonById.get(offering.season_id) : undefined;
      if (!offering || !slug || !isModule(slug) || !season) continue;

      const classMeetings = meetingsByClass.get(e.class_id) ?? [];
      const infos = classMeetings.map((m) => ({
        id: m.id,
        minutes: m.academic_minutes,
        past: m.meeting_date! < today || (m.meeting_date === today && !!m.end_time && toMinutes(m.end_time) <= nowMinute),
      }));
      const keys = [`s:${profile.id}`, ...(request ? [`r:${request.id}`] : [])];
      const credits = toProgressCredits(keys.flatMap((k) => creditsByKey.get(k) ?? []));
      const progress = computeProgress(infos, credits);
      const lastMeetingDate = classMeetings.map((m) => m.meeting_date!).sort().at(-1) ?? null;

      const forOffering = assessmentsByOffering.get(e.season_volume_offering_id) ?? [];
      const finalRow = forOffering.find((a) => a.type === "final");
      const recoveryRow = forOffering.find((a) => a.type === "recovery");

      enrollmentFacts.push({
        enrollmentId: e.id,
        volume: slug,
        seasonId: season.id,
        seasonName: season.name,
        seasonStartsOn: season.starts_on ?? "",
        className: classNameById.get(e.class_id) ?? "Turma",
        status: e.status,
        finalGrade: e.final_grade === null ? null : Number(e.final_grade),
        updatedAt: e.updated_at,
        attendance:
          infos.length === 0
            ? null
            : {
                totalMinutes: progress.totalMinutes,
                attendedMinutes: progress.attendedMinutes,
                missedMinutes: progress.missedMinutes,
                absences: progress.absences,
                situation: progress.situation,
                allMeetingsPast: infos.every((i) => i.past),
                lastMeetingDate,
              },
        finalAssessment: finalRow ? assessmentFact(finalRow, e.id) : null,
        recoveryAssessment: recoveryRow ? assessmentFact(recoveryRow, e.id) : null,
      });
    }

    const historyFacts: HistoryRecordFact[] = history
      .filter((h) => h.student_id === profile.id && isModule(h.volume_slug))
      .map((h) => ({
        id: h.id,
        volume: h.volume_slug as ModuleSlug,
        seasonLabel: h.season_label,
        origin: h.origin,
        evidence: h.evidence,
        validatedAt: h.validated_at,
        validatedByName: validatorName.get(h.validated_by) ?? null,
      }));

    // Possíveis duplicatas: só sinal para conferência, nunca mesclagem. O CPF é a prova
    // mais forte; e-mail igual em outro cadastro também merece olhar.
    const suspects = new Map<string, DuplicateSuspect>();
    if (request) {
      for (const other of sameCpf) {
        if (other.id === request.id || (other.student_id && other.student_id === profile.id)) continue;
        suspects.set(other.student_id ?? `req:${other.id}`, { profileId: other.student_id ?? other.id, name: other.full_name, reason: "mesmo CPF" });
      }
    }
    const email = profile.email?.toLowerCase();
    if (email) {
      for (const other of sameEmail) {
        if (other.id === profile.id || other.email?.toLowerCase() !== email) continue;
        const known = suspects.get(other.id);
        suspects.set(other.id, { profileId: other.id, name: other.full_name, reason: known ? `${known.reason} e mesmo e-mail` : "mesmo e-mail" });
      }
    }

    result.set(profile.id, {
      studentId: profile.id,
      requestId: request?.id ?? null,
      fullName: profile.full_name,
      email: profile.email ?? request?.email ?? null,
      phone: profile.phone ?? request?.phone ?? null,
      enrollments: enrollmentFacts,
      history: historyFacts,
      prerequisiteNote: request?.prerequisite_declaration?.trim() || null,
      pendingJustifications: pendingCount.get(profile.id) ?? 0,
      suspectedDuplicates: [...suspects.values()],
    });
  }

  return result;
}

/** Alunos com matrícula ativa em Voz na temporada: o universo de candidatos da edição. */
export async function loadVozCandidateIds(supabase: DB, seasonId: string): Promise<string[]> {
  const { data: volume } = await supabase.from("volumes").select("id").eq("slug", "voz").maybeSingle();
  if (!volume) return [];
  const { data: offerings } = await supabase.from("season_volume_offerings").select("id").eq("season_id", seasonId).eq("volume_id", volume.id);
  const offeringIds = (offerings ?? []).map((o) => o.id);
  if (offeringIds.length === 0) return [];
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .in("season_volume_offering_id", offeringIds)
    .not("status", "in", "(canceled,withdrawn)");
  return [...new Set((enrollments ?? []).map((e) => e.student_id))];
}
