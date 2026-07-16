import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Minhas turmas" };

export default async function ProfessorTurmasPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();

  // RLS (teacher_assignments_select_own) já restringe a leitura aos
  // próprios vínculos — fonte única do escopo do professor.
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("class_id, function")
    .eq("teacher_id", authContext.userId);

  const classIds = [...new Set((assignments ?? []).map((a) => a.class_id))];

  const { data: classes } = classIds.length
    ? await supabase
        .from("classes")
        .select("id, name, season_volume_offering_id")
        .in("id", classIds)
    : { data: [] };

  const offeringIds = (classes ?? []).map((c) => c.season_volume_offering_id);
  const { data: offerings } = offeringIds.length
    ? await supabase.from("season_volume_offerings").select("id, season_id, volume_id").in("id", offeringIds)
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
      <h1 className="text-lg font-semibold text-neutral-900">Minhas turmas</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {(classes ?? []).map((klass) => {
          const offering = offeringsById.get(klass.season_volume_offering_id);
          const volumeName = offering ? volumesById.get(offering.volume_id)?.name : undefined;
          const seasonName = offering ? seasonsById.get(offering.season_id)?.name : undefined;

          return (
            <Link key={klass.id} href={`/professor/turmas/${klass.id}`}>
              <Card className="h-full transition-colors hover:border-brand-blue">
                <h2 className="font-semibold text-neutral-900">{klass.name}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {volumeName ?? "Volume"} — {seasonName ?? "Temporada"}
                </p>
              </Card>
            </Link>
          );
        })}
        {(classes ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhuma turma atribuída ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
