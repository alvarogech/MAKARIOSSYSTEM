import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { formatBrazilianPhone } from "@/services/phone";
import { recordCeremonyAttendance, withdrawInvite } from "@/modules/graduation/actions/participants";
import { loadBoard, loadEditions, pickEdition } from "@/modules/graduation/board";
import { CONTACT_LABELS } from "@/modules/graduation/boardView";
import { ModuleBadge, OverallBadge, REQUIREMENT_STYLE } from "@/modules/graduation/components/badges";
import { CertificateNameForm, ContactPanel, FollowUpForm, RevokeHistoryForm, RsvpForm, ValidateHistoryForm } from "@/modules/graduation/components/StudentPanels";
import { buildContactMessage } from "@/modules/graduation/contactMessage";
import { formatDateTime, formatShortDay } from "@/modules/graduation/dates";
import { certificateNameOf } from "@/modules/graduation/lists";
import { MODULE_LABELS, ORIGIN_LABELS } from "@/modules/graduation/types";

export const metadata: Metadata = { title: "Candidato à formatura" };
export const dynamic = "force-dynamic";

const CHANNEL_LABELS: Record<string, string> = { whatsapp: "WhatsApp", telefone: "Telefone", presencial: "Presencial", email: "E-mail", outro: "Outro", plataforma: "Plataforma" };
const RESPONSE_LABELS: Record<string, string> = { sem_resposta: "Sem resposta", confirmado: "Confirmou presença", nao_comparece: "Não comparecerá" };
const AUDIT_LABELS: Record<string, string> = {
  participante_incluido: "Incluído na edição",
  convite_enviado: "Convidado para a cerimônia",
  convite_retirado: "Convite retirado",
  resposta_registrada: "Resposta registrada",
  comparecimento_registrado: "Comparecimento registrado",
  historico_validado: "Histórico validado",
  historico_revogado: "Histórico revogado",
  edicao_alterada: "Edição alterada",
};

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <Card id={id} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="font-semibold text-neutral-900">{title}</h2>
      {children}
    </Card>
  );
}

export default async function CandidatoPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { studentId } = await params;
  const sp = await searchParams;
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "graduation", action: "view" })) {
    return <AccessDenied description="Você não tem permissão para ver a Central de Formatura." />;
  }

  const supabase = await createSupabaseServerClient();
  const editions = await loadEditions(supabase);
  const edition = pickEdition(editions, typeof sp.edicao === "string" ? sp.edicao : undefined);
  if (!edition) notFound();

  const board = await loadBoard(supabase, edition);
  const row = board.rows.find((r) => r.studentId === studentId);
  if (!row) notFound();

  const [{ data: contacts }, { data: audit }, { data: historyRows }] = await Promise.all([
    supabase
      .from("graduation_contacts")
      .select("id, requirement_key, channel, contacted_at, contacted_by, summary, response, next_step, due_date")
      .eq("edition_id", edition.id)
      .eq("student_id", studentId)
      .order("contacted_at", { ascending: false })
      .limit(50),
    supabase
      .from("graduation_audit")
      .select("id, action, detail, actor_id, created_at, edition_id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("graduation_history_records")
      .select("id, volume_slug, season_label, origin, evidence, validated_by, validated_at, revoked_at, revoked_by, revoke_reason")
      .eq("student_id", studentId)
      .order("validated_at", { ascending: false }),
  ]);

  const actorIds = [...new Set([...(contacts ?? []).map((c) => c.contacted_by), ...(audit ?? []).map((a) => a.actor_id), ...(historyRows ?? []).flatMap((h) => [h.validated_by, h.revoked_by])].filter((x): x is string => !!x))];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const open = row.evaluation.requirements.filter((r) => r.blocking && r.state !== "cumprido");
  const others = row.evaluation.requirements.filter((r) => !r.blocking);
  const followByKey = new Map(row.requirementFollowUps.map((f) => [f.requirementKey, f]));
  const message = buildContactMessage(row.name, open);
  const canContact = can(auth, { resource: "graduation", action: "contact" });
  const canValidate = can(auth, { resource: "graduation", action: "validate_history" });
  const canRsvp = can(auth, { resource: "graduation", action: "record_rsvp" });
  const canConfigure = can(auth, { resource: "graduation", action: "configure" });
  const responsibles = [{ id: auth.userId, name: `${auth.fullName} (eu)` }, ...board.responsibles.filter((r) => r.id !== auth.userId)];
  const cert = certificateNameOf(row);
  const p = row.participant;
  const activeHistory = (historyRows ?? []).filter((h) => !h.revoked_at);
  const pastHistory = (historyRows ?? []).filter((h) => h.revoked_at);

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/coordenacao/formatura?edicao=${edition.id}`} className="text-sm text-brand-blue hover:underline">
        ← Todos os candidatos
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-neutral-900">{row.name}</h2>
            <p className="text-sm text-neutral-500">
              {row.className ?? "Sem turma de Voz"} {row.seasonName ? `· ${row.seasonName}` : ""} · {edition.name}
            </p>
          </div>
          <OverallBadge status={row.evaluation.overall} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-neutral-500">Telefone</dt>
            <dd className="text-neutral-900">{row.phone ? formatBrazilianPhone(row.phone) : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-neutral-500">E-mail</dt>
            <dd className="break-all text-neutral-900">{row.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Identificador interno</dt>
            <dd className="break-all font-mono text-xs text-neutral-600">{row.studentId}</dd>
          </div>
        </dl>
        {row.requestId ? (
          <Link href={`/coordenacao/alunos/${row.requestId}`} className="text-sm font-medium text-brand-blue hover:underline">
            Abrir ficha completa do aluno →
          </Link>
        ) : null}
      </Card>

      <Section title="Jornada acadêmica">
        <ol className="grid gap-3 md:grid-cols-4">
          {row.evaluation.modules.map((m) => (
            <li key={m.slug} className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-neutral-900">{m.label}</span>
                <ModuleBadge status={m.status} />
              </div>
              <p className="text-xs text-neutral-600">
                {m.status === "concluido" ? `Concluído${m.completedOn ? ` em ${m.completedOn.split("-").reverse().join("/")}` : ""}${m.seasonName ? ` · ${m.seasonName}` : ""}` : (m.seasonName ?? "Sem temporada")}
              </p>
              {m.className ? <p className="text-xs text-neutral-500">{m.className}</p> : null}
              {m.attendance && m.attendance.totalMinutes > 0 ? (
                <p className="text-xs text-neutral-600">
                  Frequência: {Math.round((m.attendance.attendedMinutes / (m.attendance.allMeetingsPast ? m.attendance.totalMinutes : Math.max(1, m.attendance.attendedMinutes + m.attendance.missedMinutes))) * 1000) / 10}%
                </p>
              ) : null}
              {m.grade !== null ? (
                <p className="text-xs text-neutral-600">
                  Nota: {m.grade.toFixed(1).replace(".", ",")}
                  {m.passingGrade !== null ? ` (mínimo ${m.passingGrade.toFixed(1).replace(".", ",")})` : ""}
                </p>
              ) : null}
              <p className="text-xs text-neutral-400">Origem: {ORIGIN_LABELS[m.origin]}</p>
            </li>
          ))}
          <li className="flex flex-col justify-between gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-neutral-300 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-900">Formatura</span>
              <ArrowRight className="size-4 text-neutral-400" aria-hidden="true" />
            </div>
            <OverallBadge status={row.evaluation.overall} />
          </li>
        </ol>
        {row.evaluation.nearlyDone ? (
          <p className="rounded-[var(--radius-sm)] bg-brand-blue-light px-3 py-2 text-sm text-brand-blue-dark">
            Falta <strong>uma única pendência</strong> para este aluno concluir a jornada.
          </p>
        ) : null}
      </Section>

      <Section title="O que falta para este aluno?">
        {open.length === 0 ? (
          <p className="text-sm text-neutral-600">
            {row.evaluation.overall === "apto" ? "Nada. Todos os requisitos estão cumpridos e comprovados." : "Nenhuma pendência a cobrar agora: o que resta ainda está em andamento."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((r) => {
              const follow = followByKey.get(r.key);
              return (
                <li key={r.key} className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">{r.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REQUIREMENT_STYLE[r.state].className}`}>{REQUIREMENT_STYLE[r.state].label}</span>
                  </div>
                  <p className="text-neutral-700">{r.reason}</p>
                  {r.guidance ? <p className="text-neutral-600"><strong className="font-medium">Orientação:</strong> {r.guidance}</p> : null}
                  {r.action ? (
                    <Link href={r.action.href} className="text-sm font-medium text-brand-blue hover:underline">
                      {r.action.label} →
                    </Link>
                  ) : null}
                  {follow ? (
                    <p className="text-xs text-neutral-500">
                      Acompanhamento: {CONTACT_LABELS[follow.contactStatus]}
                      {follow.responsibleName ? ` · ${follow.responsibleName}` : ""}
                      {follow.dueDate ? ` · prazo ${formatShortDay(follow.dueDate)}` : ""}
                      {follow.nextStep ? ` · próximo: ${follow.nextStep}` : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {others.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-neutral-600">
            {others.map((r) => (
              <li key={r.key}>
                <span className="mr-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Aviso</span>
                {r.reason} {r.guidance}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      {canContact ? (
        <Section title="Contato e acompanhamento">
          <ContactPanel editionId={edition.id} studentId={studentId} phone={row.phone} initialMessage={message} />
          <hr className="border-neutral-100" />
          <FollowUpForm
            editionId={edition.id}
            studentId={studentId}
            requirements={open.map((r) => ({ key: r.key, title: r.title }))}
            responsibles={responsibles}
            current={row.followUp}
          />
        </Section>
      ) : null}

      <Section title="Histórico de acompanhamento">
        {(contacts ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum contato registrado ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
            {(contacts ?? []).map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5 py-2">
                <p className="text-xs text-neutral-500">
                  {formatDateTime(c.contacted_at)} · {CHANNEL_LABELS[c.channel] ?? c.channel} · {actorName.get(c.contacted_by ?? "") ?? "—"}
                </p>
                {c.summary ? <p className="text-neutral-800">{c.summary}</p> : null}
                {c.response ? <p className="text-neutral-600">Resposta: {c.response}</p> : null}
                {c.next_step || c.due_date ? <p className="text-neutral-600">Próximo passo: {c.next_step ?? "—"}{c.due_date ? ` (até ${formatShortDay(c.due_date)})` : ""}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {row.evaluation.overall === "apto" && row.followUp && row.followUp.contactStatus !== "regularizacao_concluida" ? (
          <p className="text-xs text-green-700">Hoje os registros mostram o aluno apto. Se a regularização veio do contato, marque o acompanhamento como concluído.</p>
        ) : null}
      </Section>

      <Section title="Histórico acadêmico validado" id="historico">
        <p className="text-sm text-neutral-600">
          Conclusões de módulos anteriores à plataforma, reconhecidas por um administrador com origem e evidência. O registro original nunca é editado nem apagado.
        </p>
        {activeHistory.length === 0 ? <p className="text-sm text-neutral-500">Nenhum reconhecimento vigente.</p> : null}
        <ul className="flex flex-col gap-3">
          {activeHistory.map((h) => (
            <li key={h.id} className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-green-200 bg-green-50/40 p-3 text-sm">
              <p className="font-medium text-neutral-900">
                {MODULE_LABELS[h.volume_slug as keyof typeof MODULE_LABELS] ?? h.volume_slug}
                {h.season_label ? ` · ${h.season_label}` : ""}
              </p>
              <p className="text-neutral-700">Origem: {h.origin}</p>
              <p className="text-neutral-700">Evidência: {h.evidence}</p>
              <p className="text-xs text-neutral-500">
                Validado por {actorName.get(h.validated_by) ?? "—"} em {formatDateTime(h.validated_at)}
              </p>
              {canValidate ? <RevokeHistoryForm id={h.id} /> : null}
            </li>
          ))}
        </ul>
        {pastHistory.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-600">{pastHistory.length} reconhecimento(s) revogado(s)</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {pastHistory.map((h) => (
                <li key={h.id} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-neutral-600">
                  {MODULE_LABELS[h.volume_slug as keyof typeof MODULE_LABELS] ?? h.volume_slug} · {h.origin} · revogado em {formatDateTime(h.revoked_at)} por {actorName.get(h.revoked_by ?? "") ?? "—"}: {h.revoke_reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {canValidate ? <ValidateHistoryForm studentId={studentId} /> : <p className="text-xs text-neutral-500">Apenas o administrador pode validar ou revogar histórico.</p>}
      </Section>

      <Section title="Participação na cerimônia">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-neutral-500">Convite</dt>
            <dd>{p.invitedAt ? `Convidado em ${formatDateTime(p.invitedAt)}` : "Não convidado"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Resposta</dt>
            <dd>
              {p.invitedAt ? RESPONSE_LABELS[p.response] : "—"}
              {p.respondedAt ? ` (${formatDateTime(p.respondedAt)})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Origem da resposta</dt>
            <dd>{p.responseSource === "coordenacao" ? `Coordenação · ${CHANNEL_LABELS[p.responseChannel ?? ""] ?? p.responseChannel}` : p.responseSource === "aluno" ? "Pelo aluno" : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Comparecimento no dia</dt>
            <dd>{p.ceremonyAttendance === "compareceu" ? "Compareceu" : p.ceremonyAttendance === "nao_compareceu" ? "Não compareceu" : "Ainda não registrado"}</dd>
          </div>
        </dl>
        {row.evaluation.overall !== "apto" ? (
          <p className="text-sm text-neutral-600">Só alunos aptos recebem convite. A resposta de presença nunca altera a situação acadêmica.</p>
        ) : null}
        {p.invitedAt && canRsvp ? <RsvpForm editionId={edition.id} studentId={studentId} /> : null}
        {p.invitedAt && canRsvp ? (
          <form action={recordCeremonyAttendance} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="editionId" value={edition.id} />
            <input type="hidden" name="studentId" value={studentId} />
            <span className="text-neutral-600">Comparecimento no dia:</span>
            {(["compareceu", "nao_compareceu", "nao_registrado"] as const).map((value) => (
              <button
                key={value}
                type="submit"
                name="value"
                value={value}
                className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-blue hover:text-brand-blue"
              >
                {value === "compareceu" ? "Compareceu" : value === "nao_compareceu" ? "Não compareceu" : "Limpar"}
              </button>
            ))}
          </form>
        ) : null}
        {p.invitedAt && canConfigure ? (
          <form action={withdrawInvite}>
            <input type="hidden" name="editionId" value={edition.id} />
            <input type="hidden" name="studentId" value={studentId} />
            <button type="submit" className="text-xs text-neutral-500 underline hover:text-danger">
              Retirar o convite (apaga a resposta registrada)
            </button>
          </form>
        ) : null}
        {row.evaluation.overall === "apto" && canConfigure ? (
          <div className="flex flex-col gap-1">
            <CertificateNameForm editionId={edition.id} studentId={studentId} suggested={cert.name} checked={cert.checked} />
            {cert.issues.length > 0 ? <p className="text-xs text-amber-700">Atenção no nome cadastrado: {cert.issues.join("; ")}.</p> : null}
            {cert.checked ? <p className="text-xs text-green-700">Nome conferido pela coordenação.</p> : null}
          </div>
        ) : null}
      </Section>

      <Section title="Registro de alterações">
        {(audit ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">Sem alterações registradas.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {(audit ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 text-neutral-700">
                <span className="w-32 shrink-0 text-xs text-neutral-400">{formatDateTime(a.created_at)}</span>
                <span>{AUDIT_LABELS[a.action] ?? a.action}</span>
                <span className="text-xs text-neutral-500">{actorName.get(a.actor_id ?? "") ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
