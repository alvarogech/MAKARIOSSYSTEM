import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateClassForm } from "@/modules/academic/components/CreateClassForm";
import { AssignTeacherForm } from "@/modules/academic/components/AssignTeacherForm";

export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const [
    { data: offerings },
    { data: volumes },
    { data: seasons },
    { data: templates },
    { data: classes },
    { data: meetings },
    { data: assignments },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("season_volume_offerings").select("id, season_id, volume_id"),
    supabase.from("volumes").select("id, name"),
    supabase.from("seasons").select("id, name"),
    supabase
      .from("class_templates")
      .select("id, name, meetings_count, total_academic_minutes")
      .order("name"),
    supabase
      .from("classes")
      .select("id, name, location, status, season_volume_offering_id, class_template_id")
      .order("created_at"),
    supabase.from("class_meetings").select("class_id"),
    supabase.from("teacher_assignments").select("id, teacher_id, class_id, function"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const seasonsById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const offeringLabel = (offeringId: string) => {
    const offering = (offerings ?? []).find((o) => o.id === offeringId);
    if (!offering) return "Oferta";
    const volume = volumesById.get(offering.volume_id)?.name ?? "Volume";
    const season = seasonsById.get(offering.season_id)?.name ?? "Temporada";
    return `${volume} — ${season}`;
  };
  const templatesById = new Map((templates ?? []).map((t) => [t.id, t]));
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const meetingsCountByClass = new Map<string, number>();
  for (const meeting of meetings ?? []) {
    meetingsCountByClass.set(
      meeting.class_id,
      (meetingsCountByClass.get(meeting.class_id) ?? 0) + 1,
    );
  }

  const assignmentsByClass = new Map<string, string[]>();
  for (const assignment of assignments ?? []) {
    const teacherName =
      profilesById.get(assignment.teacher_id)?.full_name ?? "Professor";
    const list = assignmentsByClass.get(assignment.class_id) ?? [];
    list.push(teacherName);
    assignmentsByClass.set(assignment.class_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">Turmas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ao criar a turma, todos os encontros do modelo de horário
          escolhido são gerados automaticamente (sem data — a coordenação
          ajusta as datas reais depois).
        </p>
        <div className="mt-4">
          <CreateClassForm
            offerings={(offerings ?? []).map((o) => ({
              id: o.id,
              label: offeringLabel(o.id),
            }))}
            templates={(templates ?? []).map((t) => ({
              id: t.id,
              name: `${t.name} (${t.meetings_count} encontros, ${t.total_academic_minutes / 60}h)`,
            }))}
          />
        </div>

        <ul className="mt-6 divide-y divide-neutral-100">
          {(classes ?? []).map((klass) => (
            <li key={klass.id} className="py-2 text-sm text-neutral-700">
              <span className="font-medium">{klass.name}</span> —{" "}
              {offeringLabel(klass.season_volume_offering_id)} ·{" "}
              {templatesById.get(klass.class_template_id)?.name}
              <span className="text-neutral-400">
                {" "}
                · {meetingsCountByClass.get(klass.id) ?? 0} encontros
                {klass.location ? ` · ${klass.location}` : ""}
              </span>
              <div className="text-xs text-neutral-400">
                Professor(es):{" "}
                {(assignmentsByClass.get(klass.id) ?? []).join(", ") ||
                  "nenhum designado"}
              </div>
            </li>
          ))}
          {(classes ?? []).length === 0 ? (
            <li className="py-2 text-sm text-neutral-400">
              Nenhuma turma criada ainda.
            </li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">
          Designar professor
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          O vínculo do professor com a turma é a única fonte de verdade do
          escopo dele no sistema.
        </p>
        <div className="mt-4">
          <AssignTeacherForm
            classes={(classes ?? []).map((k) => ({
              id: k.id,
              label: `${k.name} — ${offeringLabel(k.season_volume_offering_id)}`,
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
