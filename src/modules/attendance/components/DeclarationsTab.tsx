import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { DeclarationReviewForm } from "./DeclarationReviewForm";
import { CloseWindowButton, DeclarationWindowForm } from "./DeclarationWindowForm";

const SCHEDULE: Record<string, string> = { terca_quinta: "Terça/quinta", sabado: "Sábado" };
const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Em análise", className: "bg-amber-50 text-amber-700" },
  validated: { label: "Validada", className: "bg-green-50 text-green-700" },
  revoked: { label: "Revogada", className: "bg-red-50 text-red-700" },
};

function br(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(`${dateKey}T12:00:00-03:00`));
}
const list = (numbers: number[]) => (numbers.length === 0 ? "—" : numbers.join(", "));

/**
 * Aba "Autodeclarações" da presença: janelas abertas, e a fila de respostas dos alunos
 * com os conflitos (quando já havia QR ou lançamento manual no mesmo encontro) em destaque.
 */
export async function DeclarationsTab({ status, volume }: { status?: string; volume?: string }) {
  const supabase = await createSupabaseServerClient();

  const [{ data: windows }, { data: declarations }] = await Promise.all([
    supabase.from("attendance_declaration_windows").select("meeting_id, closes_at, enabled").order("closes_at"),
    supabase.from("attendance_declarations").select("id, meeting_id, student_id, enrollment_request_id, lessons, status, declared_at"),
  ]);

  const meetingIds = [...new Set([...(windows ?? []).map((w) => w.meeting_id), ...(declarations ?? []).map((d) => d.meeting_id)])];
  const { data: meetings } = meetingIds.length
    ? await supabase
        .from("class_meetings")
        .select("id, sequence, meeting_date, classes!inner(class_templates!inner(slug), season_volume_offerings!inner(volumes!inner(name, slug)))")
        .in("id", meetingIds)
    : { data: [] };
  const meetingById = new Map((meetings ?? []).map((m) => [m.id, m]));
  const label = (id: string) => {
    const m = meetingById.get(id);
    if (!m) return "Encontro";
    const c = m.classes;
    return `${c.season_volume_offerings.volumes.name}, ${SCHEDULE[c.class_templates.slug] ?? c.class_templates.slug}, encontro ${m.sequence} (${m.meeting_date ? br(m.meeting_date) : "—"})`;
  };

  const studentIds = [...new Set((declarations ?? []).map((d) => d.student_id))];
  const [{ data: profiles }, { data: scans }, { data: manual }, { data: pastMeetings }] = await Promise.all([
    studentIds.length ? supabase.from("profiles").select("id, full_name").in("id", studentIds) : Promise.resolve({ data: [] }),
    meetingIds.length
      ? supabase.from("attendance_scans").select("meeting_id, student_id, enrollment_request_id, lesson_numbers").in("meeting_id", meetingIds)
      : Promise.resolve({ data: [] }),
    meetingIds.length
      ? supabase.from("attendance_manual_entries").select("meeting_id, student_id, enrollment_request_id, lessons").in("meeting_id", meetingIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("class_meetings")
      .select("id, sequence, meeting_date, classes!inner(class_templates!inner(slug), season_volume_offerings!inner(volumes!inner(name)))")
      .lte("meeting_date", new Date().toISOString().slice(0, 10))
      .neq("status", "canceled")
      .order("meeting_date", { ascending: false })
      .limit(60),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const rows = (declarations ?? [])
    .map((d) => {
      const sameMeeting = (x: { meeting_id: string; student_id: string | null; enrollment_request_id: string | null }) =>
        x.meeting_id === d.meeting_id &&
        ((d.enrollment_request_id && x.enrollment_request_id === d.enrollment_request_id) || x.student_id === d.student_id);
      const qr = (scans ?? []).filter(sameMeeting).flatMap((s) => s.lesson_numbers ?? []);
      const man = (manual ?? []).filter(sameMeeting).flatMap((m) => m.lessons ?? []);
      const existing = [...new Set([...qr, ...man])].sort((a, b) => a - b);
      const declared = [...d.lessons].sort((a, b) => a - b);
      const conflict = existing.length > 0 && JSON.stringify(existing) !== JSON.stringify(declared);
      const m = meetingById.get(d.meeting_id);
      return {
        ...d,
        declared,
        existing,
        conflict,
        name: nameById.get(d.student_id) ?? "Aluno",
        meetingLabel: label(d.meeting_id),
        volumeName: m?.classes.season_volume_offerings.volumes.name ?? "",
      };
    })
    .filter((r) => !status || r.status === status)
    .filter((r) => !volume || r.volumeName === volume)
    .sort((a, b) => Number(b.conflict) - Number(a.conflict) || a.meetingLabel.localeCompare(b.meetingLabel) || a.name.localeCompare(b.name));

  const volumes = [...new Set((declarations ?? []).map((d) => meetingById.get(d.meeting_id)?.classes.season_volume_offerings.volumes.name).filter(Boolean))] as string[];
  const pendingCount = (declarations ?? []).filter((d) => d.status === "pending").length;
  const conflictCount = rows.filter((r) => r.conflict).length;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Janelas de autodeclaração</h3>
        <p className="text-xs text-neutral-500">
          Quando a chamada de um encontro falha, abra a janela: o aluno matriculado na turma responde se esteve e em quais aulas,
          até a data-limite. Conta para a frequência como “Autodeclarada” e você valida ou revoga abaixo.
        </p>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-[var(--radius-sm)] border border-neutral-100 text-sm">
          {(windows ?? []).map((w) => (
            <li key={w.meeting_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                {label(w.meeting_id)} ·{" "}
                <span className={w.enabled && new Date(w.closes_at) > new Date() ? "text-green-700" : "text-neutral-400"}>
                  {w.enabled && new Date(w.closes_at) > new Date() ? "aberta" : "encerrada"} até{" "}
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(w.closes_at))}
                </span>
              </span>
              {w.enabled ? <CloseWindowButton meetingId={w.meeting_id} /> : null}
            </li>
          ))}
          {(windows ?? []).length === 0 ? <li className="px-3 py-2 text-neutral-400">Nenhuma janela aberta.</li> : null}
        </ul>
        <DeclarationWindowForm
          meetings={(pastMeetings ?? []).map((m) => ({
            id: m.id,
            label: `${m.classes.season_volume_offerings.volumes.name}, ${SCHEDULE[m.classes.class_templates.slug] ?? ""}, encontro ${m.sequence} (${m.meeting_date ? br(m.meeting_date) : "—"})`,
          }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">
            Respostas ({rows.length}) · {pendingCount} em análise{conflictCount > 0 ? ` · ${conflictCount} com conflito` : ""}
          </h3>
          <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="aba" value="autodeclaracoes" />
            <select name="status" defaultValue={status ?? ""} className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1">
              <option value="">Todos os status</option>
              <option value="pending">Em análise</option>
              <option value="validated">Validadas</option>
              <option value="revoked">Revogadas</option>
            </select>
            <select name="volume" defaultValue={volume ?? ""} className="rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1">
              <option value="">Todos os volumes</option>
              {volumes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button type="submit" className="text-brand-blue hover:underline">
              Filtrar
            </button>
          </form>
        </div>

        {rows.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">Nenhuma resposta ainda.</Card>
        ) : (
          <DeclarationReviewForm>
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-[var(--radius-sm)] border border-neutral-100 text-sm">
              {rows.map((r) => (
                <li key={r.id} className={`flex items-start gap-3 px-3 py-2 ${r.conflict ? "bg-amber-50/60" : ""}`}>
                  <input type="checkbox" name="ids" value={r.id} className="mt-1 size-4" aria-label={`Selecionar ${r.name}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{r.name}</p>
                    <p className="text-xs text-neutral-500">{r.meetingLabel}</p>
                    <p className="text-xs text-neutral-700">
                      {r.declared.length > 0 ? `Declarou as aulas ${list(r.declared)}` : "Declarou que NÃO esteve"}
                      {r.existing.length > 0 ? ` · já havia QR/manual: aulas ${list(r.existing)}` : ""}
                    </p>
                    {r.conflict ? <p className="text-xs font-medium text-amber-700">⚠ Conflito: a declaração difere do que já estava registrado — as aulas se somam, sem contar duas vezes.</p> : null}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ""}`}>
                    {STATUS[r.status]?.label ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          </DeclarationReviewForm>
        )}
      </section>
    </div>
  );
}
