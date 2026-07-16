import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Turma" };

export default async function ProfessorTurmaDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
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

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, location, season_volume_offering_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass) {
    notFound();
  }

  const [{ data: offering }, { data: meetings }, { data: enrollments }, { data: reports }] =
    await Promise.all([
      supabase
        .from("season_volume_offerings")
        .select("volume_id")
        .eq("id", klass.season_volume_offering_id)
        .single(),
      supabase
        .from("class_meetings")
        .select("id, sequence, meeting_date, academic_minutes, status")
        .eq("class_id", classId)
        .order("sequence"),
      supabase
        .from("enrollments")
        .select("id, student_id, status")
        .eq("class_id", classId),
      supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", authContext.userId),
    ]);

  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: attendanceCounts } = await supabase
    .from("attendance_records")
    .select("meeting_id")
    .in("meeting_id", (meetings ?? []).map((m) => m.id));
  const recordedMeetingIds = new Set((attendanceCounts ?? []).map((a) => a.meeting_id));
  const reportedMeetingIds = new Set((reports ?? []).map((r) => r.meeting_id));

  const volume = offering
    ? await supabase.from("volumes").select("name").eq("id", offering.volume_id).maybeSingle()
    : { data: null };

  const contentsQuery = offering
    ? await supabase
        .from("contents")
        .select("id, title, type, classification")
        .eq("volume_id", offering.volume_id)
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{klass.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {volume.data?.name ?? "Volume"} {klass.location ? `· ${klass.location}` : ""}
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Alunos ({(enrollments ?? []).length})</h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {(enrollments ?? []).map((enrollment) => (
            <li key={enrollment.id} className="py-1.5 text-neutral-700">
              {profilesById.get(enrollment.student_id)?.full_name ?? "Aluno"}{" "}
              <span className="text-neutral-400">({enrollment.status})</span>
            </li>
          ))}
          {(enrollments ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum aluno matriculado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Encontros</h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {(meetings ?? []).map((meeting) => (
            <li key={meeting.id} className="flex items-center justify-between py-2">
              <span className="text-neutral-700">
                Encontro {meeting.sequence}
                {meeting.meeting_date ? ` — ${meeting.meeting_date}` : " — data a definir"}{" "}
                <span className="text-neutral-400">({meeting.academic_minutes} min)</span>
                {recordedMeetingIds.has(meeting.id) ? (
                  <span className="ml-2 text-xs text-success">frequência registrada</span>
                ) : null}
                {reportedMeetingIds.has(meeting.id) ? (
                  <span className="ml-2 text-xs text-success">relatório enviado</span>
                ) : null}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/professor/turmas/${classId}/encontros/${meeting.id}/frequencia`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  Frequência
                </Link>
                <Link
                  href={`/professor/turmas/${classId}/encontros/${meeting.id}/relatorio`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Relatório
                </Link>
              </div>
            </li>
          ))}
          {(meetings ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum encontro cadastrado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Materiais e preparação de aula</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Conteúdos publicados do volume — inclui material exclusivo de
          professor, quando existir.
        </p>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {(contentsQuery.data ?? []).map((content) => (
            <li key={content.id} className="py-1.5 text-neutral-700">
              {content.title} <span className="text-neutral-400">({content.type}, {content.classification})</span>
            </li>
          ))}
          {(contentsQuery.data ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum material publicado ainda.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
