import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Relatórios pós-aula" };

export default async function RelatoriosPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: reports } = await supabase
    .from("class_meeting_reports")
    .select("id, meeting_id, teacher_id, content_completed, occurrences, students_needing_attention, submitted_at")
    .order("submitted_at", { ascending: false });

  const meetingIds = (reports ?? []).map((r) => r.meeting_id);
  const teacherIds = (reports ?? []).map((r) => r.teacher_id);

  const [{ data: meetings }, { data: teachers }] = await Promise.all([
    meetingIds.length
      ? supabase.from("class_meetings").select("id, class_id, sequence").in("id", meetingIds)
      : Promise.resolve({ data: [] }),
    teacherIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", teacherIds)
      : Promise.resolve({ data: [] }),
  ]);

  const classIds = [...new Set((meetings ?? []).map((m) => m.class_id))];
  const { data: classes } = classIds.length
    ? await supabase.from("classes").select("id, name").in("id", classIds)
    : { data: [] };

  const meetingsById = new Map((meetings ?? []).map((m) => [m.id, m]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const teacherNameById = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Relatórios pós-aula</h1>
        <p className="mt-1 text-sm text-neutral-500">Enviados pelos professores após cada encontro.</p>
      </div>

      <Card>
        <ul className="divide-y divide-neutral-100 text-sm">
          {(reports ?? []).map((report) => {
            const meeting = meetingsById.get(report.meeting_id);
            return (
              <li key={report.id} className="py-3">
                <p className="font-medium text-neutral-800">
                  {meeting ? classNameById.get(meeting.class_id) : "Turma"} — Encontro{" "}
                  {meeting?.sequence} · {teacherNameById.get(report.teacher_id) ?? "Professor"}
                </p>
                {report.content_completed ? (
                  <p className="mt-1 text-neutral-600">Conteúdo: {report.content_completed}</p>
                ) : null}
                {report.occurrences ? (
                  <p className="mt-1 text-neutral-600">Ocorrências: {report.occurrences}</p>
                ) : null}
                {report.students_needing_attention ? (
                  <p className="mt-1 text-danger">
                    Atenção: {report.students_needing_attention}
                  </p>
                ) : null}
              </li>
            );
          })}
          {(reports ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum relatório recebido ainda.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
