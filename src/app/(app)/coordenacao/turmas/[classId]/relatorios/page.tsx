import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classContext } from "@/modules/academic/classHub";

export const metadata: Metadata = { title: "Relatórios da turma" };

const day = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

export default async function TurmaRelatoriosPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await classContext(supabase, classId);
  if (!ctx) notFound();

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { data: meetings } = await supabase
    .from("class_meetings")
    .select("id, sequence, meeting_date")
    .eq("class_id", classId)
    .neq("status", "canceled")
    .lt("meeting_date", today)
    .order("meeting_date");

  const ids = (meetings ?? []).map((m) => m.id);
  const { data: reports } = ids.length
    ? await supabase
        .from("class_meeting_reports")
        .select("id, meeting_id, teacher_id, content_completed, students_needing_attention, occurrences, observation")
        .in("meeting_id", ids)
    : { data: [] };
  const teacherIds = [...new Set((reports ?? []).map((r) => r.teacher_id))];
  const { data: teachers } = teacherIds.length ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds) : { data: [] };
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold text-neutral-900">Relatórios pós-aula</h2>
      <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
        {(meetings ?? []).map((m) => {
          const list = (reports ?? []).filter((r) => r.meeting_id === m.id);
          return (
            <li key={m.id} className="py-3">
              <p className="font-medium text-neutral-900">
                Encontro {m.sequence} · {m.meeting_date ? day(m.meeting_date) : "—"}
              </p>
              {list.length === 0 ? (
                <p className="text-danger">Relatório não enviado.</p>
              ) : (
                list.map((r) => (
                  <div key={r.id} className="mt-1 text-neutral-700">
                    <p className="text-xs text-neutral-500">{teacherName.get(r.teacher_id) ?? "Professor"}</p>
                    {r.content_completed ? <p>Conteúdo: {r.content_completed}</p> : null}
                    {r.students_needing_attention ? <p className="text-danger">Atenção: {r.students_needing_attention}</p> : null}
                    {r.occurrences || r.observation ? <p>Observações: {[r.occurrences, r.observation].filter(Boolean).join(" · ")}</p> : null}
                  </div>
                ))
              )}
            </li>
          );
        })}
        {(meetings ?? []).length === 0 ? <li className="py-3 text-neutral-400">Nenhum encontro realizado ainda.</li> : null}
      </ul>
    </Card>
  );
}
