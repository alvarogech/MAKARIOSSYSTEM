import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { EnrollmentForm } from "@/modules/academic/components/EnrollmentForm";

export const metadata: Metadata = { title: "Matrículas" };

export default async function MatriculasPage() {
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
    { data: classes },
    { data: enrollments },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("season_volume_offerings").select("id, season_id, volume_id"),
    supabase.from("volumes").select("id, name"),
    supabase.from("seasons").select("id, name"),
    supabase.from("classes").select("id, name, season_volume_offering_id"),
    supabase
      .from("enrollments")
      .select("id, student_id, season_volume_offering_id, class_id, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const seasonsById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const volumeNamesById = Object.fromEntries(
    (volumes ?? []).map((v) => [v.id, v.name]),
  );
  const classesById = new Map((classes ?? []).map((c) => [c.id, c]));
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const offeringLabel = (offeringId: string) => {
    const offering = (offerings ?? []).find((o) => o.id === offeringId);
    if (!offering) return "Oferta";
    const volume = volumesById.get(offering.volume_id)?.name ?? "Volume";
    const season = seasonsById.get(offering.season_id)?.name ?? "Temporada";
    return `${volume} — ${season}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">
          Nova matrícula
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Um aluno pode ter matrículas simultâneas em mais de um volume. A
          matrícula é bloqueada quando o pré-requisito do volume não foi
          concluído — a coordenação pode autorizar uma exceção justificada.
        </p>
        <div className="mt-4">
          <EnrollmentForm
            offerings={(offerings ?? []).map((o) => ({
              id: o.id,
              label: offeringLabel(o.id),
            }))}
            classes={(classes ?? []).map((c) => ({
              id: c.id,
              label: `${c.name} — ${offeringLabel(c.season_volume_offering_id)}`,
              offeringId: c.season_volume_offering_id,
            }))}
            volumeNamesById={volumeNamesById}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">
          Matrículas registradas
        </h2>
        <ul className="mt-4 divide-y divide-neutral-100">
          {(enrollments ?? []).map((enrollment) => (
            <li key={enrollment.id} className="py-2 text-sm text-neutral-700">
              <span className="font-medium">
                {profilesById.get(enrollment.student_id)?.full_name ??
                  "Aluno"}
              </span>{" "}
              — {offeringLabel(enrollment.season_volume_offering_id)} ·{" "}
              {classesById.get(enrollment.class_id)?.name}
              <span className="text-neutral-400"> ({enrollment.status})</span>
            </li>
          ))}
          {(enrollments ?? []).length === 0 ? (
            <li className="py-2 text-sm text-neutral-400">
              Nenhuma matrícula criada ainda.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
