import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { ClassReportForm } from "@/modules/teaching/components/ClassReportForm";
import { loadReportEligibility } from "@/modules/teaching/reportSettingsLoader";

export const metadata: Metadata = { title: "Relatório pós-aula" };

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ classId: string; meetingId: string }>;
}) {
  const { classId, meetingId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();

  const eligibility = await loadReportEligibility(supabase, meetingId, authContext.userId);
  if (!eligibility.meeting || eligibility.meeting.classId !== classId) {
    notFound();
  }
  const { meeting } = eligibility;

  const { data: existingReport } = await supabase
    .from("class_meeting_reports")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("teacher_id", authContext.userId)
    .maybeSingle();

  const back = (
    <Link href={`/professor/turmas/${classId}`} className="text-sm text-brand-blue hover:underline">
      ← Voltar à turma
    </Link>
  );
  const title = <h1 className="text-lg font-semibold text-neutral-900">Relatório pós-aula — Encontro {meeting.sequence}</h1>;

  // Semestre sem exigência: nada de formulário, mas o que já foi enviado continua visível.
  if (eligibility.state === "inactive") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          {title}
          <p className="mt-2 text-sm text-neutral-600">Relatórios pós-aula não estão ativos neste semestre. Não há nada a enviar.</p>
          {existingReport ? (
            <p className="mt-3 text-sm text-neutral-500">
              Você enviou um relatório deste encontro em{" "}
              {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(existingReport.submitted_at))}.
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  if (eligibility.state === "not_scheduled") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          {title}
          <p className="mt-2 text-sm text-neutral-600">Você não está escalado neste encontro, então não há relatório para você aqui.</p>
        </Card>
      </div>
    );
  }

  if (eligibility.state === "not_over") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          {title}
          <p className="mt-2 text-sm text-neutral-600">
            O relatório abre depois do término da aula
            {meeting.date && meeting.endTime ? ` (${dayLabel(meeting.date)}, às ${meeting.endTime.slice(0, 5)})` : ""}.
          </p>
        </Card>
      </div>
    );
  }

  const { data: roster } = await supabase.rpc("class_roster", { p_class_id: classId });
  const students = (roster ?? [])
    .map((p) => ({ id: (p.student_id ?? p.request_id) as string | null, name: p.full_name }))
    .filter((p): p is { id: string; name: string } => Boolean(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="flex flex-col gap-4">
      {back}

      <Card>
        {title}
        <p className="mt-1 text-sm text-neutral-500">
          Enviado diretamente à coordenação.
          {existingReport
            ? ` Último envio: ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(existingReport.updated_at))}.`
            : " Ainda pendente."}
        </p>

        <div className="mt-4">
          <ClassReportForm
            meetingId={meetingId}
            students={students}
            existing={
              existingReport
                ? {
                    contentCompleted: existingReport.content_completed ?? "",
                    attentionStudentIds: existingReport.attention_student_ids ?? [],
                    studentsNeedingAttention: existingReport.students_needing_attention ?? "",
                    observation: [existingReport.occurrences, existingReport.observation].filter(Boolean).join("\n\n"),
                  }
                : null
            }
          />
        </div>
      </Card>
    </div>
  );
}
