import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Solicitações de inscrição" };

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

export default async function EnrollmentRequestsPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: requests, error } = await supabase
    .from("enrollment_requests")
    .select(
      "id, protocol, full_name, cpf_last4, email, phone, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug, prerequisite_declaration, notes, status, created_at",
    )
    .order("created_at", { ascending: false });

  const volumeLabel = (slug: string | null) =>
    ENROLLMENT_VOLUMES.find((volume) => volume.slug === slug)?.label ?? slug ?? "—";
  const scheduleLabel = (slug: string | null) =>
    ENROLLMENT_SCHEDULES.find((schedule) => schedule.slug === slug)?.label ?? slug ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Solicitações de inscrição</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pedidos recebidos pela página pública. Aprovação, convite e matrícula continuam sendo etapas distintas.
        </p>
      </div>

      {error ? (
        <Card><p className="text-sm text-danger">Não foi possível carregar as solicitações.</p></Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {(requests ?? []).map((request) => (
          <Card key={request.id} className="p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-neutral-900">{request.full_name}</h2>
                  <span className="rounded-full bg-brand-blue-light px-2.5 py-1 text-xs font-medium text-brand-blue-dark">
                    {statusLabels[request.status] ?? request.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  {request.protocol} · CPF final {request.cpf_last4} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(request.created_at))}
                </p>
              </div>
              <div className="text-sm text-neutral-600 sm:text-right">
                <p>{request.email}</p>
                <p>{request.phone}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-[var(--radius-md)] bg-neutral-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Volume principal</p>
                <p className="mt-1 font-medium text-neutral-800">
                  {volumeLabel(request.primary_volume_slug)} · {scheduleLabel(request.primary_schedule_slug)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Segundo volume</p>
                <p className="mt-1 font-medium text-neutral-800">
                  {request.wants_second_volume
                    ? `${volumeLabel(request.secondary_volume_slug)} · ${scheduleLabel(request.secondary_schedule_slug)}`
                    : "Não solicitado"}
                </p>
              </div>
            </div>

            {request.prerequisite_declaration ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Declaração de pré-requisito</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{request.prerequisite_declaration}</p>
              </div>
            ) : null}
            {request.notes ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{request.notes}</p>
              </div>
            ) : null}
          </Card>
        ))}

        {!error && (requests ?? []).length === 0 ? (
          <Card><p className="text-sm text-neutral-500">Nenhuma solicitação recebida ainda.</p></Card>
        ) : null}
      </div>
    </div>
  );
}

