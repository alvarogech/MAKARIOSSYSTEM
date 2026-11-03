import type { Metadata } from "next";
import Link from "next/link";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { recordCeremonyAttendance } from "@/modules/graduation/actions/participants";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import { ceremonyStats, EDITION_STATUS_LABELS, rsvpWindow, type EditionStatus } from "@/modules/graduation/ceremony";
import { CeremonyForm, InviteAllForm, PublishForm, StatusForm } from "@/modules/graduation/components/CeremonyForms";
import { EditionBar } from "@/modules/graduation/components/EditionBar";
import { OverallBadge } from "@/modules/graduation/components/badges";
import { formatDateTime, formatDay, toLocalInput } from "@/modules/graduation/dates";
import { certificateNameOf } from "@/modules/graduation/lists";

export const metadata: Metadata = { title: "Cerimônia — Formatura" };
export const dynamic = "force-dynamic";

const NEXT_STATES: Record<EditionStatus, EditionStatus[]> = {
  em_preparacao: ["regularizacao", "arquivada"],
  regularizacao: ["em_preparacao", "arquivada"],
  confirmacoes_abertas: ["confirmacoes_encerradas"],
  confirmacoes_encerradas: ["realizada"],
  realizada: ["arquivada"],
  arquivada: [],
};

const WINDOW_LABEL = {
  nao_publicada: "Cerimônia ainda não publicada: os alunos não veem nada.",
  aberta: "Confirmações abertas.",
  prazo_encerrado: "O prazo para confirmar terminou.",
  encerrada: "Confirmações encerradas.",
} as const;

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4 transition-colors hover:border-brand-blue">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="text-2xl font-semibold text-neutral-900">{value}</span>
    </Link>
  );
}

export default async function CerimoniaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "graduation", action: "view" })) {
    return <AccessDenied description="Você não tem permissão para ver a Central de Formatura." />;
  }

  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const editions = await loadEditions(supabase);
  const edition = pickEdition(editions, typeof params.edicao === "string" ? params.edicao : undefined);
  if (!edition) {
    return (
      <Card>
        <p className="text-sm text-neutral-600">
          Ainda não há edição de formatura. <Link className="text-brand-blue underline" href="/coordenacao/formatura">Crie a primeira na Visão geral.</Link>
        </p>
      </Card>
    );
  }

  const board = await loadBoard(supabase, edition);
  const canConfigure = can(auth, { resource: "graduation", action: "configure" });
  const canRsvp = can(auth, { resource: "graduation", action: "record_rsvp" });
  const closed = edition.status === "arquivada" || edition.status === "realizada";
  const window = rsvpWindow({ status: edition.status, publishedAt: edition.publishedAt, rsvpDeadline: edition.rsvpDeadline }, new Date());

  const stats = ceremonyStats(
    board.rows.map((r) => ({
      invitedAt: r.participant.invitedAt,
      response: r.participant.response,
      responseSource: r.participant.responseSource,
      incomplete: !r.phone || !certificateNameOf(r).checked,
    })),
  );
  const invited = board.rows.filter((r) => r.participant.invitedAt);
  const aptoNotInvited = board.rows.filter((r) => r.evaluation.overall === "apto" && !r.participant.invitedAt).length;
  const nameOf = new Map(board.rows.map((r) => [r.studentId, r.name]));
  const list = (code: string) => `/coordenacao/formatura/relatorios?edicao=${edition.id}&lista=${code}`;
  const attendanceDone = invited.filter((r) => r.participant.ceremonyAttendance !== "nao_registrado").length;

  const values = {
    editionId: edition.id,
    updatedAt: edition.updatedAt,
    eventName: edition.eventName ?? "",
    eventDate: edition.eventDate ?? "",
    eventTime: edition.eventTime ?? "",
    locationName: edition.locationName ?? "",
    address: edition.address ?? "",
    instructions: edition.instructions ?? "",
    rsvpDeadline: toLocalInput(edition.rsvpDeadline),
    inviteMessage: edition.inviteMessage ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <EditionBar editions={editions} current={edition} computedAt={board.computedAt} />

      {board.conflicts.length > 0 ? (
        <Alert variant="warning">
          <p className="font-medium">{board.conflicts.length} convidado(s) deixaram de estar aptos depois do convite:</p>
          <ul className="mt-1 list-disc pl-5">
            {board.conflicts.map((c) => (
              <li key={c.studentId}>
                <Link className="underline" href={`/coordenacao/formatura/${c.studentId}?edicao=${edition.id}`}>
                  {nameOf.get(c.studentId)}
                </Link>{" "}
                ({c.response === "confirmado" ? "tinha confirmado" : c.response === "nao_comparece" ? "tinha recusado" : "sem resposta"})
              </li>
            ))}
          </ul>
          <p className="mt-1">Conferir o caso antes de manter o convite ou a confirmação.</p>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-neutral-900">Dados da cerimônia</h2>
            <p className="text-sm text-neutral-600">
              {edition.eventDate ? `${formatDay(edition.eventDate)}${edition.eventTime ? ` às ${edition.eventTime}` : ""}` : "Data ainda não definida — nada é mostrado aos alunos até a publicação."}
            </p>
          </div>
          <span className="rounded-full bg-brand-blue-light px-2.5 py-1 text-xs font-medium text-brand-blue-dark">{EDITION_STATUS_LABELS[edition.status]}</span>
        </div>
        {canConfigure ? <CeremonyForm values={values} disabled={closed} /> : <p className="text-sm text-neutral-500">Você pode ver, mas não editar, os dados da cerimônia.</p>}
      </Card>

      {canConfigure && !closed ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold text-neutral-900">Publicação e convites</h2>
            <p className="text-sm text-neutral-600">
              {WINDOW_LABEL[window]}
              {edition.publishedAt ? ` Publicada em ${formatDateTime(edition.publishedAt)}.` : ""}
            </p>
          </div>
          <PublishForm editionId={edition.id} published={!!edition.publishedAt && edition.status !== "confirmacoes_abertas"} />
          <hr className="border-neutral-100" />
          <InviteAllForm editionId={edition.id} aptoPending={aptoNotInvited} />
          <hr className="border-neutral-100" />
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-800">Estado da edição</p>
            <StatusForm editionId={edition.id} options={NEXT_STATES[edition.status].filter((s) => s !== "confirmacoes_abertas")} />
          </div>
        </Card>
      ) : null}

      <section aria-label="Indicadores da cerimônia" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Confirmações</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Formandos convidados" value={stats.invited} href={list("convidados")} />
          <Stat label="Presença confirmada" value={stats.confirmed} href={list("confirmados")} />
          <Stat label="Não participarão" value={stats.declined} href={list("concluiram_sem_participar")} />
          <Stat label="Aguardando resposta" value={stats.awaiting} href={list("sem_resposta")} />
          <Stat label="Registradas pela coordenação" value={stats.recordedByCoordination} href={list("convidados")} />
          <Stat label="Confirmados com cadastro incompleto" value={stats.confirmedIncomplete} href={list("certificados")} />
        </div>
        <p className="text-xs text-neutral-500">
          “Incompleto” = sem telefone ou com o nome do certificado ainda não conferido. Confirmar presença não altera a situação acadêmica de ninguém.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          Convidados <span className="text-sm font-normal text-neutral-500">· comparecimento registrado: {attendanceDone} de {invited.length}</span>
        </h2>
        {invited.length === 0 ? (
          <Card className="py-8 text-center text-sm text-neutral-500">Ninguém foi convidado ainda.</Card>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-neutral-200 bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Aluno</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Resposta</th>
                  <th className="px-3 py-2">Comparecimento no dia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {invited.map((r) => (
                  <tr key={r.studentId} className="align-top">
                    <td className="px-3 py-3">
                      <Link href={`/coordenacao/formatura/${r.studentId}?edicao=${edition.id}`} className="font-medium text-neutral-900 hover:text-brand-blue hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <OverallBadge status={r.evaluation.overall} />
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-700">
                      {r.participant.response === "confirmado" ? "Confirmou" : r.participant.response === "nao_comparece" ? "Não comparecerá" : "Sem resposta"}
                      {r.participant.responseSource === "coordenacao" ? <span className="block text-neutral-500">registrado pela coordenação ({r.participant.responseChannel})</span> : null}
                    </td>
                    <td className="px-3 py-3">
                      {canRsvp ? (
                        <form action={recordCeremonyAttendance} className="flex flex-wrap gap-1">
                          <input type="hidden" name="editionId" value={edition.id} />
                          <input type="hidden" name="studentId" value={r.studentId} />
                          {(["compareceu", "nao_compareceu"] as const).map((value) => (
                            <button
                              key={value}
                              type="submit"
                              name="value"
                              value={value}
                              aria-pressed={r.participant.ceremonyAttendance === value}
                              className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-xs font-medium ${
                                r.participant.ceremonyAttendance === value ? "border-brand-blue bg-brand-blue text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-blue"
                              }`}
                            >
                              {value === "compareceu" ? "Compareceu" : "Não compareceu"}
                            </button>
                          ))}
                        </form>
                      ) : (
                        <span className="text-xs text-neutral-600">{r.participant.ceremonyAttendance === "nao_registrado" ? "Ainda não registrado" : r.participant.ceremonyAttendance === "compareceu" ? "Compareceu" : "Não compareceu"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
