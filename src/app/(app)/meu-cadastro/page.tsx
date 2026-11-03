import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";
import { scheduleLabel, volumeLabel } from "@/modules/enrollment/labels";
import { helpProblemLabel } from "@/modules/support/helpRequest";
import { StudentAdjustmentForm } from "@/modules/support/components/StudentAdjustmentForm";

export const metadata: Metadata = { title: "Meu cadastro" };

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export default async function MeuCadastroPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: enrollments }, { data: requests }] = await Promise.all([
    supabase.from("enrollments").select("id, status, class_id").eq("student_id", auth.userId).order("created_at", { ascending: false }),
    supabase
      .from("help_requests")
      .select("id, problems, message, wanted_volume_slug, wanted_schedule_slug, status, created_at, resolved_at")
      .eq("student_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const classIds = [...new Set((enrollments ?? []).map((e) => e.class_id))];
  const { data: classes } = classIds.length
    ? await supabase.from("classes").select("id, name").in("id", classIds)
    : { data: [] as { id: string; name: string }[] };
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Meu cadastro</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Confira em qual volume e turma você está. Se algo estiver errado, peça o ajuste aqui: a coordenação recebe o pedido e
          corrige.
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-900">Minha matrícula</h2>
        {(enrollments ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">Você ainda não tem matrícula em uma turma.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
            {(enrollments ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-neutral-900">{className.get(e.class_id) ?? "Turma"}</span>
                <span className="text-neutral-500">{ENROLLMENT_STATUS_LABELS[e.status] ?? e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-neutral-900">Algo está errado?</h2>
        <StudentAdjustmentForm />
      </Card>

      {(requests ?? []).length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold text-neutral-900">Meus pedidos</h2>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {(requests ?? []).map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-neutral-500">Enviado em {when(r.created_at)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "resolvido" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {r.status === "resolvido" ? "Resolvido" : "Aguardando a coordenação"}
                  </span>
                </div>
                <p className="text-neutral-800">{r.problems.map(helpProblemLabel).join(" · ")}</p>
                {r.wanted_volume_slug && r.wanted_schedule_slug ? (
                  <p className="text-neutral-600">
                    Quero ir para: {volumeLabel(r.wanted_volume_slug)} · {scheduleLabel(r.wanted_schedule_slug)}
                  </p>
                ) : null}
                {r.message ? <p className="whitespace-pre-line text-neutral-600">{r.message}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
