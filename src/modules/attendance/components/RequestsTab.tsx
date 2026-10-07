import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { RequestReviewForm } from "./RequestReviewForm";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Aprovado", className: "bg-green-50 text-green-700" },
  rejected: { label: "Recusado", className: "bg-red-50 text-red-700" },
};
const SCHEDULE: Record<string, string> = { terca_quinta: "terça/quinta", sabado: "sábado" };

const day = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(`${key}T12:00:00-03:00`));
const list = (numbers: number[]) => numbers.join(", ");

/** Aba "Solicitações" da presença: pedidos de presença dos alunos, com justificativa. */
export async function RequestsTab({ canDecide, status }: { canDecide: boolean; status?: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from("attendance_requests")
    .select("id, meeting_id, student_id, lessons, justification, status, created_at, decision_note")
    .order("created_at", { ascending: false });

  const meetingIds = [...new Set((requests ?? []).map((r) => r.meeting_id))];
  const studentIds = [...new Set((requests ?? []).map((r) => r.student_id))];
  const [{ data: meetings }, { data: profiles }, { data: scans }, { data: manual }] = await Promise.all([
    meetingIds.length
      ? supabase
          .from("class_meetings")
          .select("id, sequence, meeting_date, classes!inner(class_templates!inner(slug), season_volume_offerings!inner(volumes!inner(name)))")
          .in("id", meetingIds)
      : Promise.resolve({ data: [] }),
    studentIds.length ? supabase.from("profiles").select("id, full_name").in("id", studentIds) : Promise.resolve({ data: [] }),
    meetingIds.length
      ? supabase.from("attendance_scans").select("meeting_id, student_id, enrollment_request_id, lesson_numbers").in("meeting_id", meetingIds)
      : Promise.resolve({ data: [] }),
    meetingIds.length
      ? supabase.from("attendance_manual_entries").select("meeting_id, student_id, enrollment_request_id, lessons").in("meeting_id", meetingIds)
      : Promise.resolve({ data: [] }),
  ]);
  const meetingById = new Map((meetings ?? []).map((m) => [m.id, m]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const rows = (requests ?? [])
    .filter((r) => !status || r.status === status)
    .map((r) => {
      const m = meetingById.get(r.meeting_id);
      const existing = [
        ...(scans ?? []).filter((s) => s.meeting_id === r.meeting_id && s.student_id === r.student_id).flatMap((s) => s.lesson_numbers ?? []),
        ...(manual ?? []).filter((x) => x.meeting_id === r.meeting_id && x.student_id === r.student_id).flatMap((x) => x.lessons ?? []),
      ];
      return {
        ...r,
        name: nameById.get(r.student_id) ?? "Aluno",
        label: m
          ? `${m.classes.season_volume_offerings.volumes.name}, ${SCHEDULE[m.classes.class_templates.slug] ?? ""}, encontro ${m.sequence} (${m.meeting_date ? day(m.meeting_date) : "—"})`
          : "Encontro",
        existing: [...new Set(existing)].sort((a, b) => a - b),
      };
    });

  const pending = (requests ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">
          Pedidos de presença ({rows.length}) · {pending} aguardando
        </h3>
        <form method="get" className="flex items-center gap-2 text-sm">
          <input type="hidden" name="aba" value="solicitacoes" />
          <select name="status" defaultValue={status ?? ""} className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1">
            <option value="">Todos</option>
            <option value="pending">Aguardando</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Recusados</option>
          </select>
          <button type="submit" className="text-brand-blue hover:underline">
            Filtrar
          </button>
        </form>
      </div>
      <p className="text-xs text-neutral-500">
        O aluno pede a presença de um encontro que já começou e explica o motivo. Só conta para a frequência depois de aprovado.
      </p>

      {rows.length === 0 ? (
        <Card className="p-4 text-sm text-neutral-500">Nenhum pedido por enquanto.</Card>
      ) : (
        <RequestReviewForm canDecide={canDecide}>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-[var(--radius-sm)] border border-neutral-100 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-3 py-3">
                {canDecide ? <input type="checkbox" name="ids" value={r.id} className="mt-1 size-4" aria-label={`Selecionar pedido de ${r.name}`} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.label}</p>
                  <p className="text-xs text-neutral-700">
                    Pede as aulas {list(r.lessons)}
                    {r.existing.length > 0 ? ` · já consta presença nas aulas ${list(r.existing)}` : " · nenhuma presença registrada nesse encontro"}
                  </p>
                  <p className="mt-1 rounded bg-neutral-50 px-2 py-1 text-neutral-800">“{r.justification}”</p>
                  {r.decision_note ? <p className="mt-1 text-xs text-neutral-600">Sua observação: {r.decision_note}</p> : null}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ""}`}>{STATUS[r.status]?.label ?? r.status}</span>
              </li>
            ))}
          </ul>
        </RequestReviewForm>
      )}
    </div>
  );
}
