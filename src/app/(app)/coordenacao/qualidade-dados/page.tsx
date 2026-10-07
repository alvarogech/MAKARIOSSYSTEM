import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CancelDuplicateButton, DemoFlagButton } from "@/modules/academic/components/DataQualityButtons";
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
    }[];
  }[];
  shared_email_requests?: { email: string; names: string[] }[];
  duplicate_teacher_invites?: { id: string; email: string; name: string | null; phone: string | null; same_as: string }[];
  teacher_phones?: { id: string; name: string; phone: string | null }[];
  demo_profiles?: { id: string; name: string; email: string | null }[];
}

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "nunca";

function Section({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <div>
        <h2 className="font-semibold text-neutral-900">
          {title} <span className="font-normal text-neutral-400">({count})</span>
        </h2>
        <p className="text-xs text-neutral-500">{hint}</p>
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Qualidade dos dados</h1>
        <p className="mt-1 text-sm text-neutral-500">
          O que o sistema encontrou de duplicado ou incompleto e que precisa de uma decisão sua. Nada é apagado ou unido sozinho.
        </p>
      </div>

      <Section
        title="Contas duplicadas"
        hint="Duas contas com o mesmo e-mail. Escolha qual manter e cancele a matrícula da outra — o histórico fica."
        count={duplicates.length}
      >
        <ul className="flex flex-col gap-3">
          {duplicates.map((group) => (
            <li key={group.email} className="rounded-[var(--radius-sm)] border border-neutral-200 p-3 text-sm">
              <p className="font-medium text-neutral-900">{group.email}</p>
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
                    {profile.enrollments.some((e) => e.status === "active") ? <CancelDuplicateButton profileId={profile.id} /> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Convites de professor repetidos"
        hint="Convite ainda pendente com o WhatsApp de um professor que já está ativo (provavelmente outro e-mail da mesma pessoa)."
        count={inviteDupes.length}
      >
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {inviteDupes.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-neutral-800">
                {invite.name ?? "Professor(a)"} · {invite.email}
                <span className="block text-xs text-neutral-500">Mesmo WhatsApp de {invite.same_as}, que já está ativo.</span>
              </span>
              <RevokeInvitationButton invitationId={invite.id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Professores sem WhatsApp completo"
        hint="Falta o número ou o DDD + 9 dígitos. Sem isso a coordenação não consegue chamar."
        count={phones.length}
      >
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {phones.map((teacher) => (
            <li key={teacher.id} className="py-2 text-neutral-800">
              {teacher.name} <span className="text-neutral-500">· {teacher.phone ?? "sem número cadastrado"}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="E-mails compartilhados entre inscrições"
        hint="Pessoas diferentes com o mesmo e-mail (família, por exemplo). Cada uma recebe o próprio convite; quem divide e-mail entra com código de acesso."
        count={shared.length}
      >
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {shared.map((item) => (
            <li key={item.email} className="py-2 text-neutral-800">
              {item.email} <span className="text-neutral-500">· {item.names.join(" / ")}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
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
