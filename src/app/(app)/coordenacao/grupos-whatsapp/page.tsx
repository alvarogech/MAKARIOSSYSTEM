import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { SendGroupEmailsButton } from "@/modules/whatsappGroups/components/SendGroupEmailsButton";

export const metadata: Metadata = { title: "Grupos de WhatsApp" };

const ACTIVE_STATUSES = ["active", "regularization", "approved"];

export default async function GruposWhatsappPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: volumes }, { data: groups }, { data: offerings }, { data: sentRows }] = await Promise.all([
    supabase.from("volumes").select("id, name, order_index").order("order_index"),
    supabase.from("volume_whatsapp_groups").select("volume_id, invite_url"),
    supabase.from("season_volume_offerings").select("id, volume_id"),
    supabase.from("volume_whatsapp_group_emails").select("student_id, volume_id"),
  ]);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, season_volume_offering_id")
    .in("status", ACTIVE_STATUSES);

  const volumeByOffering = new Map((offerings ?? []).map((o) => [o.id, o.volume_id]));
  const studentsByVolume = new Map<string, Set<string>>();
  for (const e of enrollments ?? []) {
    const volumeId = volumeByOffering.get(e.season_volume_offering_id);
    if (!volumeId) continue;
    if (!studentsByVolume.has(volumeId)) studentsByVolume.set(volumeId, new Set());
    studentsByVolume.get(volumeId)!.add(e.student_id);
  }
  const sentKeys = new Set((sentRows ?? []).map((r) => `${r.volume_id}:${r.student_id}`));
  const groupByVolume = new Map((groups ?? []).map((g) => [g.volume_id, g.invite_url]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Grupos de WhatsApp</h1>
        <p className="mt-1 text-sm text-neutral-500">
          O link de cada grupo já aparece na área do aluno matriculado. Aqui você também pode mandá-lo por e-mail —
          o envio vai só para quem ainda não recebeu, e novos alunos já recebem o link no e-mail de &quot;conta pronta&quot;.
        </p>
      </div>

      {(volumes ?? []).map((volume) => {
        const url = groupByVolume.get(volume.id);
        const students = studentsByVolume.get(volume.id) ?? new Set<string>();
        const received = [...students].filter((id) => sentKeys.has(`${volume.id}:${id}`)).length;
        const pending = students.size - received;

        return (
          <Card key={volume.id}>
            <h2 className="font-semibold text-neutral-900">{volume.name}</h2>
            {url ? (
              <>
                <a href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-brand-blue hover:underline">
                  {url}
                </a>
                <p className="mt-2 text-sm text-neutral-600">
                  {students.size} aluno(s) com matrícula ativa · {received} já receberam por e-mail · {pending} faltam
                </p>
                <div className="mt-3">
                  <SendGroupEmailsButton volumeId={volume.id} volumeName={volume.name} pendingCount={pending} />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-neutral-400">Sem link de grupo cadastrado.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
