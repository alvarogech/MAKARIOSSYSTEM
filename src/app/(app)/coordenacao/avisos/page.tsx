import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatSaoPauloLongDate } from "@/lib/saoPauloDate";
import { CreateAnnouncementForm } from "@/modules/academic/components/CreateAnnouncementForm";

export const metadata: Metadata = { title: "Avisos" };

export default async function AvisosPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: announcements }, { data: classes }, { data: modules }] = await Promise.all([
    supabase.from("announcements").select("id, title, body, class_id, module_id, published_at, audience").order("published_at", { ascending: false }),
    supabase.from("classes").select("id, name").order("name"),
    supabase.from("modules").select("id, name").order("name"),
  ]);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const moduleNameById = new Map((modules ?? []).map((m) => [m.id, m.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Avisos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cada aviso vai para professores, alunos ou os dois. Se for de uma turma ou módulo, só quem é daquela turma/módulo vê; sem
          turma nem módulo, vale para todos do público escolhido.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Publicados</h2>
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
          {(announcements ?? []).map((announcement) => (
            <li key={announcement.id} className="py-2">
              <p className="font-medium text-neutral-900">{announcement.title}</p>
              <p className="text-neutral-600">{announcement.body}</p>
              <p className="text-xs text-neutral-400">
                {formatSaoPauloLongDate(announcement.published_at.slice(0, 10), { capitalize: true })} ·{" "}
                {announcement.audience === "students" ? "Alunos" : announcement.audience === "all" ? "Professores e alunos" : "Professores"} ·{" "}
                {announcement.class_id
                  ? (classNameById.get(announcement.class_id) ?? "Turma")
                  : announcement.module_id
                    ? (moduleNameById.get(announcement.module_id) ?? "Módulo")
                    : "Geral"}
              </p>
            </li>
          ))}
          {(announcements ?? []).length === 0 ? <li className="py-2 text-neutral-400">Nenhum aviso publicado ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Publicar aviso</h2>
        <div className="mt-4">
          <CreateAnnouncementForm
            classes={(classes ?? []).map((c) => ({ id: c.id, name: c.name }))}
            modules={(modules ?? []).map((m) => ({ id: m.id, name: m.name }))}
          />
        </div>
      </Card>
    </div>
  );
}
