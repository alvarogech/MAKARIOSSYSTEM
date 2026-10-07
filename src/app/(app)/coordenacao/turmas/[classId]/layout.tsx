import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { ClassTabs } from "@/components/layout/ClassTabs";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

const SCHEDULE: Record<string, string> = { terca_quinta: "Terça e quinta", sabado: "Sábado" };

/** Cabeçalho e abas de uma turma: tudo sobre ela num lugar só. */
export default async function ClassHubLayout({ children, params }: { children: ReactNode; params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, location_id, class_templates!inner(slug), season_volume_offerings!inner(seasons!inner(name), volumes!inner(name))")
    .eq("id", classId)
    .maybeSingle();
  if (!klass) notFound();

  const { data: location } = klass.location_id
    ? await supabase.from("locations").select("name").eq("id", klass.location_id).maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col">
      <Link href="/coordenacao/turmas" className="mb-1 text-sm text-brand-blue hover:underline">
        ← Todas as turmas
      </Link>
      <h1 className="text-lg font-semibold text-neutral-900">{klass.name}</h1>
      <p className="mb-3 text-sm text-neutral-500">
        {klass.season_volume_offerings.volumes.name} · {SCHEDULE[klass.class_templates.slug] ?? klass.class_templates.slug} · temporada{" "}
        {klass.season_volume_offerings.seasons.name} · {location?.name ?? "local a definir"}
      </p>
      <ClassTabs classId={classId} />
      {children}
    </div>
  );
}
