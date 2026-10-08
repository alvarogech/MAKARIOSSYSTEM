import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import {
  CancelDuplicateButton,
  DeleteAccountButton,
  DeleteRequestButton,
  DemoFlagButton,
} from "@/modules/academic/components/DataQualityButtons";
import { ChangeTeacherEmailForm, UseInviteEmailButton } from "@/modules/auth/components/ChangeTeacherEmailForm";
import { EditTeacherProfileForm } from "@/modules/auth/components/EditTeacherProfileForm";
import { RevokeInvitationButton } from "@/modules/auth/components/RevokeInvitationButton";

export const metadata: Metadata = { title: "Qualidade dos dados" };

interface Report {
  duplicate_profiles?: {
    email: string;
    profiles: {
      id: string;
      name: string;
      created_at: string;
      last_sign_in_at: string | null;
      enrollments: { id: string; status: string; class: string }[];
      linked_request: boolean;
      attendance_records: number;
      delete_blocker: string | null;
    }[];
  }[];
  shared_email_requests?: {
    email: string;
    names: string[];
    requests: { id: string; name: string; status: string; created_at: string; volume: string; delete_blocker: string | null }[];
  }[];
  duplicate_teacher_invites?: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    same_as: string;
    same_as_id: string;
    same_as_email: string | null;
  }[];
  teacher_phones?: { id: string; name: string; phone: string | null; email: string | null }[];
  demo_profiles?: { id: string; name: string; email: string | null }[];
}

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "nunca";

const REQUEST_STATUS: Record<string, string> = { approved: "aprovada", pending: "pendente", cancelled: "cancelada" };
const VOLUME: Record<string, string> = { caminho: "Caminho", essencia: "Essência", voz: "Voz" };

function Section({
  id,
  title,
  hint,
  how,
  count,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  /** Caminhos para resolver, em linguagem simples. */
  how?: string[];
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="flex scroll-mt-4 flex-col gap-2">
      <div>
        <h2 className="font-semibold text-neutral-900">
          {title} <span className="font-normal text-neutral-400">({count})</span>
        </h2>
        <p className="text-xs text-neutral-500">{hint}</p>
        {count > 0 && how?.length ? (
          <ul className="mt-1.5 list-disc pl-5 text-xs text-neutral-600">
            {how.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {count === 0 ? <p className="text-sm text-success">✓ Nada a resolver aqui.</p> : children}
    </Card>
  );
}

export default async function QualidadeDadosPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }
  const isAdmin = canAccessArea(auth, "admin");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("data_quality_report");
  const report = (data ?? {}) as Report;

  const duplicates = report.duplicate_profiles ?? [];
  const shared = report.shared_email_requests ?? [];
  const inviteDupes = report.duplicate_teacher_invites ?? [];
  const phones = report.teacher_phones ?? [];
  const demos = report.demo_profiles ?? [];

  const summary = [
    { id: "contas-duplicadas", label: "Contas duplicadas", count: duplicates.length },
    { id: "convites-repetidos", label: "Convites repetidos", count: inviteDupes.length },
    { id: "professores-whatsapp", label: "Professores sem WhatsApp", count: phones.length },
    { id: "emails-compartilhados", label: "E-mails compartilhados", count: shared.length },
  ];
  const pending = summary.reduce((total, item) => total + item.count, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Qualidade dos dados</h1>
        <p className="mt-1 text-sm text-neutral-500">
          O que o sistema encontrou de duplicado ou incompleto e que precisa de uma decisão sua. Nada é apagado ou unido sozinho: cada correção é feita aqui, por você.
        </p>
        <nav aria-label="Pendências" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-600">{pending === 0 ? "Nenhuma pendência." : `${pending} ${pending === 1 ? "pendência" : "pendências"}:`}</span>
          {summary
            .filter((item) => item.count > 0)
            .map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-brand-blue"
              >
                {item.label} · {item.count}
              </a>
            ))}
        </nav>
        {!isAdmin ? (
          <p className="mt-2 text-xs text-neutral-500">
            Editar cadastro de professor, trocar e-mail de login e excluir inscrições ou contas são ações do administrador. Aqui você consegue cancelar matrículas e revogar convites.
          </p>
        ) : null}
      </div>

      <Section
        id="contas-duplicadas"
        title="Contas duplicadas"
        hint="Duas contas com o mesmo e-mail. Escolha qual manter; o histórico da que fica não muda."
        how={[
          "Cancelar matrícula: a conta continua existindo, mas sem matrícula ativa (o histórico fica).",
          "Excluir esta conta: só aparece para conta nunca usada, sem inscrição nem presença, quando a outra conta já tem matrícula ou inscrição.",
        ]}
        count={duplicates.length}
      >
        <ul className="flex flex-col gap-3">
          {duplicates.map((group) => (
            <li key={group.email} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-neutral-900">{group.email}</p>
                <Link href={`/coordenacao/inscricoes?q=${encodeURIComponent(group.email)}`} className="text-xs font-medium text-brand-blue hover:underline">
                  Ver inscrições deste e-mail
                </Link>
              </div>
              <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
                {group.profiles.map((profile) => (
                  <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="text-neutral-800">
                        {profile.name}
                        {profile.linked_request ? <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">ligada à inscrição</span> : null}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Criada em {when(profile.created_at)} · último acesso: {when(profile.last_sign_in_at)} · {profile.attendance_records} presença(s)
                      </p>
                      <p className="text-xs text-neutral-500">
                        {profile.enrollments.length === 0
                          ? "sem matrícula"
                          : profile.enrollments.map((e) => `${e.class} (${e.status})`).join("; ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {profile.enrollments.some((e) => e.status === "active") ? <CancelDuplicateButton profileId={profile.id} /> : null}
                      {isAdmin && !profile.delete_blocker ? <DeleteAccountButton profileId={profile.id} name={profile.name} /> : null}
                      {isAdmin && profile.delete_blocker ? (
                        <span className="max-w-xs text-right text-xs text-neutral-500">Não dá para excluir: {profile.delete_blocker}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="convites-repetidos"
        title="Convites de professor repetidos"
        hint="Convite ainda pendente com o WhatsApp de um professor que já está ativo (provavelmente outro e-mail da mesma pessoa)."
        how={[
          "Usar este e-mail no acesso: a pessoa passa a entrar com o e-mail do convite (a senha é a mesma) e o convite é revogado.",
          "Revogar: descarta o convite e a pessoa segue entrando com o e-mail que já usa.",
        ]}
        count={inviteDupes.length}
      >
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {inviteDupes.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0 text-neutral-800">
                {invite.name ?? "Professor(a)"} · {invite.email}
                <span className="block text-xs text-neutral-500">
                  Mesmo WhatsApp de {invite.same_as}, que já está ativo{invite.same_as_email ? ` com o e-mail ${invite.same_as_email}` : ""}.
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {isAdmin ? (
                  <UseInviteEmailButton userId={invite.same_as_id} invitationId={invite.id} email={invite.email} name={invite.same_as} />
                ) : null}
                <RevokeInvitationButton invitationId={invite.id} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="professores-whatsapp"
        title="Professores sem WhatsApp completo"
        hint="Falta o número ou o DDD + 9 dígitos. Sem isso a coordenação não consegue chamar."
        how={
          isAdmin
            ? [
                "Abra “Editar cadastro” para informar o WhatsApp (ou ajustar o nome) e salvar na hora.",
                "“Trocar e-mail de login” muda o e-mail com que a pessoa entra; a senha continua a mesma.",
              ]
            : ["Peça ao administrador para informar o WhatsApp deste professor."]
        }
        count={phones.length}
      >
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {phones.map((teacher) => (
            <li key={teacher.id} className="flex flex-col gap-2 py-3">
              <span className="text-neutral-800">
                {teacher.name}
                <span className="text-neutral-500"> · {teacher.phone ?? "sem número cadastrado"}</span>
                {teacher.email ? <span className="block text-xs text-neutral-500">Login: {teacher.email}</span> : null}
              </span>
              {isAdmin ? (
                <div className="flex flex-wrap items-start gap-2">
                  <EditTeacherProfileForm target="active" id={teacher.id} fullName={teacher.name} phone={teacher.phone} />
                  <ChangeTeacherEmailForm userId={teacher.id} currentEmail={teacher.email} name={teacher.name} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="emails-compartilhados"
        title="E-mails compartilhados entre inscrições"
        hint="Pessoas diferentes com o mesmo e-mail (família, por exemplo). Cada uma recebe o próprio convite; quem divide e-mail entra com código de acesso."
        how={[
          "Se são pessoas diferentes de verdade, não precisa fazer nada.",
          "Se uma inscrição foi feita por engano ou está repetida, abra-a para cancelar ou, sendo administrador, exclua aqui (o sistema avisa quando não é seguro).",
        ]}
        count={shared.length}
      >
        <ul className="flex flex-col gap-3 text-sm">
          {shared.map((item) => (
            <li key={item.email} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3">
              <p className="font-medium text-neutral-900">{item.email}</p>
              <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
                {item.requests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 text-neutral-800">
                      {request.name}
                      <span className="block text-xs text-neutral-500">
                        {VOLUME[request.volume] ?? request.volume} · inscrição {REQUEST_STATUS[request.status] ?? request.status} em {when(request.created_at)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/coordenacao/inscricoes?detail=${request.id}`} className="text-xs font-medium text-brand-blue hover:underline">
                          Abrir inscrição
                        </Link>
                        {isAdmin && !request.delete_blocker ? <DeleteRequestButton requestId={request.id} name={request.name} /> : null}
                      </span>
                      {isAdmin && request.delete_blocker ? (
                        <span className="max-w-xs text-right text-xs text-neutral-500">Não dá para excluir: {request.delete_blocker}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="contas-demonstracao"
        title="Contas de demonstração"
        hint="Marcadas como teste: não aparecem nas listas nem nas contagens. Nada foi apagado."
        count={demos.length}
      >
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {demos.map((demo) => (
            <li key={demo.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-neutral-800">
                {demo.name} <span className="text-neutral-500">· {demo.email}</span>
              </span>
              {isAdmin ? <DemoFlagButton profileId={demo.id} value={false} label="Voltar a contar como conta real" /> : null}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
