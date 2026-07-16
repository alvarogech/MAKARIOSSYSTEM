import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Meus volumes" };

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  regularization: "Regularização",
  approved: "Concluído",
  failed: "Não aprovado",
  canceled: "Cancelada",
  withdrawn: "Trancada",
};

export default async function MeusVolumesPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, status, season_volume_offering_id")
    .eq("student_id", authContext.userId)
    .order("created_at", { ascending: false });

  const offeringIds = (enrollments ?? []).map((e) => e.season_volume_offering_id);
  const { data: offerings } = offeringIds.length
    ? await supabase
        .from("season_volume_offerings")
        .select("id, season_id, volume_id")
        .in("id", offeringIds)
    : { data: [] };

  const volumeIds = (offerings ?? []).map((o) => o.volume_id);
  const seasonIds = (offerings ?? []).map((o) => o.season_id);
  const { data: volumes } = volumeIds.length
    ? await supabase.from("volumes").select("id, name").in("id", volumeIds)
    : { data: [] };
  const { data: seasons } = seasonIds.length
    ? await supabase.from("seasons").select("id, name").in("id", seasonIds)
    : { data: [] };

  const offeringsById = new Map((offerings ?? []).map((o) => [o.id, o]));
  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const seasonsById = new Map((seasons ?? []).map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Meus volumes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Você pode estar matriculado em mais de um volume ao mesmo tempo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(enrollments ?? []).map((enrollment) => {
          const offering = offeringsById.get(enrollment.season_volume_offering_id);
          const volumeName = offering ? volumesById.get(offering.volume_id)?.name : undefined;
          const seasonName = offering ? seasonsById.get(offering.season_id)?.name : undefined;

          return (
            <Link key={enrollment.id} href={`/meus-volumes/${enrollment.id}`}>
              <Card className="h-full transition-colors hover:border-brand-blue">
                <h2 className="font-semibold text-neutral-900">{volumeName ?? "Volume"}</h2>
                <p className="mt-1 text-sm text-neutral-500">{seasonName ?? "Temporada"}</p>
                <p className="mt-2 text-xs font-medium text-brand-blue">
                  {STATUS_LABELS[enrollment.status] ?? enrollment.status}
                </p>
              </Card>
            </Link>
          );
        })}
        {(enrollments ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhuma matrícula encontrada ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
