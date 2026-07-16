import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { AttendanceForm, type RosterEntry } from "@/modules/teaching/components/AttendanceForm";

export const metadata: Metadata = { title: "Frequência" };

export default async function FrequenciaPage({
  params,
}: {
  params: Promise<{ classId: string; meetingId: string }>;
}) {
  const { classId, meetingId } = await params;
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

  const { data: meeting } = await supabase
    .from("class_meetings")
    .select("id, sequence, academic_minutes, meeting_date, class_id")
    .eq("id", meetingId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!meeting) {
    notFound();
  }

  const [{ data: enrollments }, { data: attendanceRecords }] = await Promise.all([
    supabase.from("enrollments").select("id, student_id").eq("class_id", classId),
    supabase.from("attendance_records").select("*").eq("meeting_id", meetingId),
  ]);

  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const recordsByEnrollment = new Map((attendanceRecords ?? []).map((r) => [r.enrollment_id, r]));

  const isFinalized =
    (attendanceRecords ?? []).length > 0 &&
    (attendanceRecords ?? []).every((r) => r.finalized_at !== null);

  const roster: RosterEntry[] = (enrollments ?? []).map((enrollment) => {
    const existing = recordsByEnrollment.get(enrollment.id);
    return {
      enrollmentId: enrollment.id,
      studentName: profilesById.get(enrollment.student_id)?.full_name ?? "Aluno",
      status: existing?.status ?? "pendente",
      recognizedMinutes: existing?.recognized_minutes ?? 0,
      observation: existing?.observation ?? "",
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/professor/turmas/${classId}`} className="text-sm text-brand-blue hover:underline">
        ← Voltar à turma
      </Link>

      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">
          Frequência — Encontro {meeting.sequence}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {meeting.meeting_date ? meeting.meeting_date : "Data a definir"} ·{" "}
          {meeting.academic_minutes} minutos acadêmicos
        </p>

        <div className="mt-4">
          <AttendanceForm
            meetingId={meetingId}
            academicMinutes={meeting.academic_minutes}
            initialRoster={roster}
            isFinalized={isFinalized}
          />
        </div>
      </Card>
    </div>
  );
}
