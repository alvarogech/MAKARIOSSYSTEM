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
    .select("id, meeting_id, teacher_id, content_completed, occurrences, students_needing_attention, attention_student_ids, submitted_at")
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

  // Nomes dos alunos sinalizados (lista única da turma: com conta ou aguardando acesso).
  const classIdsForRoster = [...new Set((meetings ?? []).map((m) => m.class_id))];
  const rosterNameById = new Map<string, string>();
  for (const id of classIdsForRoster) {
    const { data: roster } = await supabase.rpc("class_roster", { p_class_id: id });
    for (const person of roster ?? []) {
      if (person.student_id) rosterNameById.set(person.student_id, person.full_name);
      if (person.request_id) rosterNameById.set(person.request_id, person.full_name);
    }
  }
  const { data: seasonRows } = await supabase.from("seasons").select("name, require_class_report").eq("status", "open");
  const inactiveSeasons = (seasonRows ?? []).filter((s) => !s.require_class_report).map((s) => s.name);

  const meetingsById = new Map((meetings ?? []).map((m) => [m.id, m]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const teacherNameById = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Relatórios pós-aula</h1>
        <p className="mt-1 text-sm text-neutral-500">Enviados pelos professores após cada encontro.</p>
        {inactiveSeasons.length > 0 ? (
          <p className="mt-2 rounded-[var(--radius-sm)] bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
            Neste semestre ({inactiveSeasons.join(", ")}) o relatório não é exigido: os professores não o veem e ele não gera pendência. Os já enviados continuam aqui.
            O administrador liga ou desliga em Configurações.
          </p>
        ) : null}
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
                {(report.attention_student_ids ?? []).length > 0 || report.students_needing_attention ? (
                  <p className="mt-1 text-danger">
                    Atenção:{" "}
                    {[
                      (report.attention_student_ids ?? []).map((id) => rosterNameById.get(id) ?? "aluno").join(", "),
                      report.students_needing_attention,
                    ]
                      .filter(Boolean)
                      .join(" — ")}
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
