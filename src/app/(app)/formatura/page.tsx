import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { RespondForm } from "@/modules/graduation/components/RespondForm";
import { ModuleBadge } from "@/modules/graduation/components/badges";
import { formatDateTime, formatDay } from "@/modules/graduation/dates";
import { loadStudentInvitation, loadStudentJourney } from "@/modules/graduation/studentView";

export const metadata: Metadata = { title: "Formatura" };
export const dynamic = "force-dynamic";

export default async function FormaturaAlunoPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();
  const [invitation, journey] = await Promise.all([loadStudentInvitation(supabase, auth.userId), loadStudentJourney(supabase, auth.userId)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">Formatura Makários</h1>

      {invitation ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-light text-brand-blue">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-neutral-900">{invitation.eventName ?? invitation.editionName}</h2>
              <p className="mt-1 text-sm text-neutral-700">{invitation.inviteMessage}</p>
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">Data</dt>
              <dd className="capitalize text-neutral-900">{formatDay(invitation.eventDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Horário</dt>
              <dd className="text-neutral-900">{invitation.eventTime ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Local</dt>
              <dd className="text-neutral-900">{invitation.locationName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Endereço</dt>
              <dd className="text-neutral-900">{invitation.address ?? "—"}</dd>
            </div>
            {invitation.instructions ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-neutral-500">Orientações</dt>
                <dd className="whitespace-pre-line text-neutral-900">{invitation.instructions}</dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">Prazo para confirmar</dt>
              <dd className="text-neutral-900">{formatDateTime(invitation.rsvpDeadline)}</dd>
            </div>
          </dl>
          {invitation.window === "prazo_encerrado" || invitation.window === "encerrada" ? (
            <p className="rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              O prazo para confirmar terminou. Se precisar mudar sua resposta, fale com a coordenação.
              {invitation.response !== "sem_resposta" ? ` Sua resposta registrada: ${invitation.response === "confirmado" ? "presença confirmada" : "não comparecerá"}.` : ""}
            </p>
          ) : (
            <RespondForm editionId={invitation.editionId} current={invitation.response} open={invitation.window === "aberta"} />
          )}
        </Card>
      ) : (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold text-neutral-900">Ainda não há convite para você</h2>
          <p className="text-sm text-neutral-700">
            Ao final do módulo Voz, a coordenação confere quem concluiu a jornada (Essência, Caminho e Voz) e convida para a cerimônia. O convite aparece aqui e na sua página inicial.
          </p>
        </Card>
      )}

      {journey.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold text-neutral-900">Sua jornada</h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {journey.map((m) => (
              <li key={m.slug} className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
                <span className="font-medium text-neutral-900">{m.label}</span>
                <ModuleBadge status={m.status} />
                {m.seasonName ? <span className="text-xs text-neutral-500">{m.seasonName}</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Este resumo vem da frequência e das avaliações registradas na plataforma. A conferência final do histórico e a confirmação de quem se forma são feitas pela coordenação. Em caso de dúvida, use o menu <strong>Meu cadastro</strong>.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
