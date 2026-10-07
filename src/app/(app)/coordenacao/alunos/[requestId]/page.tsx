import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { loadFunnel } from "@/modules/academic/funnelLoader";
import { FUNNEL_LABELS, FUNNEL_STYLE } from "@/modules/academic/studentFunnel";
import { toProgressCredits, type CreditRow } from "@/modules/attendance/credits";
import { formatHours } from "@/modules/attendance/progress";
import { SITUATION } from "@/modules/attendance/situation";
import { grNetworkLabel, scheduleLabel, volumeLabel } from "@/modules/enrollment/labels";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/services/phone";
import { buildWhatsAppLink } from "@/services/whatsapp";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";

export const metadata: Metadata = { title: "Ficha do aluno" };

const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "—";
const day = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold text-neutral-900">{title}</h2>
      {children}
    </Card>
  );
}

export default async function FichaAlunoPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: request } = await supabase
    .from("enrollment_requests")
    .select(
      "id, protocol, season_id, full_name, email, phone, cpf_last4, status, student_id, created_at, reviewed_at, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug, prerequisite_declaration, notes, is_other_church_member, other_church_name, is_emaus_member, has_gr, gr_network_slug",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (!request) notFound();

  const people = await loadFunnel(supabase, request.season_id);
  const me = people.find((p) => p.requestId === request.id);

  const studentId = request.student_id;
  const [{ data: enrollments }, { data: invitations }, { data: declarations }, { data: opened }, { data: creditRows }] = await Promise.all([
    studentId
      ? supabase.from("enrollments").select("id, status, class_id, created_at").eq("student_id", studentId)
      : Promise.resolve({ data: [] as { id: string; status: string; class_id: string; created_at: string }[] }),
    supabase
      .from("invitations")
      .select("id, invited_at, initial_email_sent_at, last_sent_at, consumed_at, revoked_at, reminder_stage")
      .eq("enrollment_request_id", request.id),
    studentId
      ? supabase.from("attendance_declarations").select("meeting_id, lessons, status, declared_at").eq("student_id", studentId)
      : Promise.resolve({ data: [] as { meeting_id: string; lessons: number[]; status: string; declared_at: string }[] }),
    studentId
      ? supabase.from("content_access").select("content_id, opens_count, last_opened_at").eq("student_id", studentId).order("last_opened_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as { content_id: string; opens_count: number; last_opened_at: string }[] }),
    supabase.rpc("attendance_credits"),
  ]);

  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];
  const [{ data: classes }, { data: meetings }, { data: contents }] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    classIds.length
      ? supabase.from("class_meetings").select("id, class_id, sequence, meeting_date, academic_minutes, end_time").in("class_id", classIds).neq("status", "canceled").order("meeting_date")
      : Promise.resolve({ data: [] as { id: string; class_id: string; sequence: number; meeting_date: string | null; academic_minutes: number; end_time: string | null }[] }),
    (opened ?? []).length
      ? supabase.from("contents").select("id, title").in("id", (opened ?? []).map((o) => o.content_id))
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const key = `r:${request.id}`;
  const mine = ((creditRows ?? []) as (CreditRow & { person_key: string })[]).filter((c) => c.person_key === key || (studentId && c.person_key === `s:${studentId}`));
  const credits = toProgressCredits(mine);
  const minutesFor = (meetingId: string) => credits.filter((c) => (c.makeupForMeetingId ?? c.meetingId) === meetingId).reduce((sum, c) => sum + c.minutes, 0);
  const sourcesFor = (meetingId: string) => [...new Set(mine.filter((c) => c.counts_for_meeting_id === meetingId).map((c) => c.source))];

  const className = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const contentTitle = new Map((contents ?? []).map((c) => [c.id, c.title]));
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const timeline = [
    { at: request.created_at, text: `Inscrição recebida (${request.protocol})` },
    ...(request.reviewed_at ? [{ at: request.reviewed_at, text: `Inscrição ${request.status === "approved" ? "aprovada" : request.status === "rejected" ? "recusada" : "atualizada"}` }] : []),
    ...(invitations ?? []).flatMap((i) => [
      { at: i.invited_at, text: "Convite de acesso gerado" },
      ...(i.initial_email_sent_at ? [{ at: i.initial_email_sent_at, text: "E-mail de acesso enviado" }] : []),
      ...(i.last_sent_at && i.last_sent_at !== i.initial_email_sent_at ? [{ at: i.last_sent_at, text: "Lembrete/reenvio do acesso" }] : []),
      ...(i.consumed_at ? [{ at: i.consumed_at, text: "Conta criada (convite aceito)" }] : []),
      ...(i.revoked_at ? [{ at: i.revoked_at, text: "Convite revogado" }] : []),
    ]),
    ...(enrollments ?? []).map((e) => ({ at: e.created_at, text: `Matrícula em ${className.get(e.class_id) ?? "turma"} (${ENROLLMENT_STATUS_LABELS[e.status] ?? e.status})` })),
    ...(declarations ?? []).map((d) => ({ at: d.declared_at, text: d.lessons.length > 0 ? `Autodeclarou presença (aulas ${d.lessons.join(", ")}) — ${d.status === "pending" ? "em análise" : d.status === "validated" ? "validada" : "revogada"}` : "Autodeclarou que não esteve em um encontro" })),
    ...(me?.lastSignInAt ? [{ at: me.lastSignInAt, text: "Último acesso à plataforma" }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/coordenacao/alunos" className="text-sm text-brand-blue hover:underline">
        ← Todos os alunos
      </Link>

      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-neutral-900">{request.full_name}</h1>
            <p className="text-sm text-neutral-500">
              {me?.courses.join(" + ")} · CPF final {request.cpf_last4} · {request.protocol}
            </p>
          </div>
          {me ? <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${FUNNEL_STYLE[me.stage]}`}>{FUNNEL_LABELS[me.stage]}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-2 text-neutral-700">
            {request.email} <CopyButton value={request.email} label="e-mail" />
          </span>
          <span className="text-neutral-700">{formatBrazilianPhone(request.phone)}</span>
          {isValidBrazilianPhone(request.phone) ? (
            <a
              href={buildWhatsAppLink(request.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              WhatsApp
            </a>
          ) : (
            <span className="text-xs text-warning">WhatsApp incompleto</span>
          )}
          <Link href={`/coordenacao/inscricoes?detail=${request.id}`} className="text-xs font-medium text-brand-blue hover:underline">
            Editar inscrição →
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Frequência">
          {me && me.totalMinutes > 0 ? (
            <>
              <p className="text-sm text-neutral-800">
                <strong>{formatHours(me.attendedMinutes)}</strong> de {formatHours(me.totalMinutes)}
                {me.pctSoFar !== null ? ` · ${me.pctSoFar}% dos encontros realizados` : ""}{" "}
                {me.situation ? (
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${SITUATION[me.situation].className}`}>{SITUATION[me.situation].label}</span>
                ) : null}
              </p>
              <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
                {(meetings ?? [])
                  .filter((m) => m.meeting_date)
                  .map((m) => {
                    const past = m.meeting_date! < todayKey;
                    const minutes = minutesFor(m.id);
                    const sources = sourcesFor(m.id);
                    return (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <span className="text-neutral-700">
                          E{m.sequence} · {day(m.meeting_date!)}
                        </span>
                        <span className={past ? (minutes >= m.academic_minutes ? "text-green-700" : minutes > 0 ? "text-amber-700" : "text-red-700") : "text-neutral-400"}>
                          {past || minutes > 0 ? `${formatHours(Math.min(minutes, m.academic_minutes))} de ${formatHours(m.academic_minutes)}` : "em breve"}
                          {sources.length > 0 ? <span className="ml-2 text-xs text-neutral-500">({sources.join(", ")})</span> : null}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Sem turma ainda — a frequência aparece quando a matrícula existir.</p>
          )}
        </Section>

        <Section title="Matrícula e acesso">
          {(enrollments ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">
              {request.status === "approved" ? "Aprovado, aguardando criar a conta (a matrícula nasce nesse momento)." : "Sem matrícula."}
            </p>
          ) : (
            <ul className="text-sm text-neutral-800">
              {(enrollments ?? []).map((e) => (
                <li key={e.id}>
                  {className.get(e.class_id) ?? "Turma"} · {ENROLLMENT_STATUS_LABELS[e.status] ?? e.status}
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Último acesso</dt>
              <dd className="text-neutral-800">{when(me?.lastSignInAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Materiais abertos</dt>
              <dd className="text-neutral-800">{me?.materialsOpened ?? 0}</dd>
            </div>
          </dl>
          {(opened ?? []).length > 0 ? (
            <ul className="text-xs text-neutral-600">
              {(opened ?? []).map((o) => (
                <li key={o.content_id}>
                  {contentTitle.get(o.content_id) ?? "Material"} · {o.opens_count}× · último em {when(o.last_opened_at)}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Inscrição">
          <ul className="text-sm text-neutral-800">
            <li>
              Pediu: {volumeLabel(request.primary_volume_slug)} · {scheduleLabel(request.primary_schedule_slug)}
              {request.wants_second_volume && request.secondary_volume_slug
                ? ` + ${volumeLabel(request.secondary_volume_slug)} · ${scheduleLabel(request.secondary_schedule_slug)}`
                : ""}
            </li>
            <li>
              Igreja: {request.is_emaus_member ? `membro da Emaús${request.has_gr ? ` (GR: ${grNetworkLabel(request.gr_network_slug)})` : " (sem GR)"}` : request.is_other_church_member ? `outra igreja${request.other_church_name ? `: ${request.other_church_name}` : ""}` : "não informado"}
            </li>
            {request.prerequisite_declaration ? <li className="whitespace-pre-wrap">Declaração: {request.prerequisite_declaration}</li> : null}
            {request.notes ? <li className="whitespace-pre-wrap">Observações: {request.notes}</li> : null}
          </ul>
        </Section>

        <Section title="Histórico">
          <ul className="flex flex-col gap-1 text-sm">
            {timeline.map((event, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-28 shrink-0 text-xs text-neutral-400">{when(event.at)}</span>
                <span className="text-neutral-800">{event.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
