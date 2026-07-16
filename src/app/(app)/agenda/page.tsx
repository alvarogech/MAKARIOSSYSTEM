import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", authContext.userId)
    .in("status", ["active", "regularization", "approved"]);

  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];

  const { data: meetings } = classIds.length
    ? await supabase
        .from("class_meetings")
        .select("id, class_id, sequence, meeting_date, start_time, end_time, location, status")
        .in("class_id", classIds)
        .order("sequence")
    : { data: [] };

  const { data: classes } = classIds.length
    ? await supabase.from("classes").select("id, name").in("id", classIds)
    : { data: [] };
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const withDate = (meetings ?? []).filter((m) => m.meeting_date);
  const withoutDate = (meetings ?? []).filter((m) => !m.meeting_date);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Agenda</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Encontros das suas turmas matriculadas.
        </p>
      </div>

      <Card>
        {withDate.length > 0 ? (
          <ul className="divide-y divide-neutral-100 text-sm">
            {withDate.map((meeting) => (
              <li key={meeting.id} className="py-2 text-neutral-700">
                <span className="font-medium">{classNameById.get(meeting.class_id)}</span> —
                {" "}Encontro {meeting.sequence} — {meeting.meeting_date}
                {meeting.start_time ? ` · ${meeting.start_time}` : ""}
                {meeting.location ? ` · ${meeting.location}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">
            Nenhum encontro com data definida ainda — a coordenação ainda
            não programou as datas reais desta temporada.
          </p>
        )}
      </Card>

      {withoutDate.length > 0 ? (
        <Card>
          <h2 className="text-sm font-medium text-neutral-700">
            Encontros previstos (sem data confirmada)
          </h2>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {withoutDate.map((meeting) => (
              <li key={meeting.id} className="py-1.5 text-neutral-500">
                {classNameById.get(meeting.class_id)} — Encontro {meeting.sequence}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
