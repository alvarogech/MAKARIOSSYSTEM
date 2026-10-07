import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { addSaoPauloDays, getSaoPauloDateKey } from "@/lib/saoPauloDate";

export const metadata: Metadata = { title: "Escala consolidada" };

const day = (key: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00-03:00`));

/** Todas as aulas das próximas 4 semanas, por professor — e as que ainda estão sem ninguém. */
export default async function EscalaConsolidadaPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();
  const today = getSaoPauloDateKey(new Date());
  const until = getSaoPauloDateKey(addSaoPauloDays(new Date(), 28));

  const { data: meetings } = await supabase
    .from("class_meetings")
    .select("id, class_id, sequence, meeting_date, start_time, end_time, classes!inner(name)")
    .gte("meeting_date", today)
    .lte("meeting_date", until)
    .neq("status", "canceled")
    .order("meeting_date")
    .order("start_time");

  const ids = (meetings ?? []).map((m) => m.id);
  const { data: blocks } = ids.length
    ? await supabase
        .from("class_meeting_blocks")
        .select("id, class_meeting_id, teacher_id, module_id, start_time, end_time, status")
        .in("class_meeting_id", ids)
        .neq("status", "canceled")
        .order("start_time")
    : { data: [] };

  const teacherIds = [...new Set((blocks ?? []).map((b) => b.teacher_id).filter((x): x is string => Boolean(x)))];
  const moduleIds = [...new Set((blocks ?? []).map((b) => b.module_id).filter((x): x is string => Boolean(x)))];
  const [{ data: teachers }, { data: modules }] = await Promise.all([
    teacherIds.length ? supabase.from("profiles").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] }),
    moduleIds.length ? supabase.from("modules").select("id, name").in("id", moduleIds) : Promise.resolve({ data: [] }),
  ]);
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
  const moduleName = new Map((modules ?? []).map((m) => [m.id, m.name]));
  const meetingById = new Map((meetings ?? []).map((m) => [m.id, m]));

  type Lesson = { key: string; date: string; time: string; className: string; classId: string; subject: string; sequence: number };
  const byTeacher = new Map<string, Lesson[]>();
  const covered = new Set<string>();
  for (const b of blocks ?? []) {
    const m = meetingById.get(b.class_meeting_id);
    if (!m?.meeting_date || !b.teacher_id) continue;
    covered.add(m.id);
    const lesson: Lesson = {
      key: b.id,
      date: m.meeting_date,
      time: `${(b.start_time ?? m.start_time ?? "").slice(0, 5)} às ${(b.end_time ?? m.end_time ?? "").slice(0, 5)}`,
      className: m.classes.name,
      classId: m.class_id,
      subject: b.module_id ? (moduleName.get(b.module_id) ?? "Matéria") : "Tema a definir",
      sequence: m.sequence,
    };
    byTeacher.set(b.teacher_id, [...(byTeacher.get(b.teacher_id) ?? []), lesson]);
  }
  const uncovered = (meetings ?? []).filter((m) => !covered.has(m.id));
  const ordered = [...byTeacher.entries()].sort((a, b) => (teacherName.get(a[0]) ?? "").localeCompare(teacherName.get(b[0]) ?? "", "pt-BR"));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Escala consolidada</h1>
        <p className="mt-1 text-sm text-neutral-500">Aulas das próximas 4 semanas, professor por professor.</p>
      </div>

      {uncovered.length > 0 ? (
        <Card className="border-danger/30 bg-danger/5">
          <h2 className="text-sm font-semibold text-danger">Encontros sem nenhum professor ({uncovered.length})</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {uncovered.map((m) => (
              <li key={m.id}>
                <Link href={`/coordenacao/turmas/${m.class_id}/escala`} className="text-brand-blue hover:underline">
                  {day(m.meeting_date!)} · {m.classes.name} · encontro {m.sequence}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {ordered.map(([teacherId, lessons]) => (
        <Card key={teacherId} className="flex flex-col gap-1 p-4">
          <h2 className="font-semibold text-neutral-900">
            {teacherName.get(teacherId) ?? "Professor"} <span className="font-normal text-neutral-400">({lessons.length} aula(s))</span>
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
            {lessons
              .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
              .map((l) => (
                <li key={l.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="text-neutral-800">
                    {day(l.date)} · {l.time}
                  </span>
                  <span className="text-neutral-600">
                    {l.subject} <span className="text-neutral-400">· {l.className} · E{l.sequence}</span>
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      ))}
      {ordered.length === 0 ? <Card className="text-sm text-neutral-400">Nenhuma aula atribuída nas próximas 4 semanas.</Card> : null}
    </div>
  );
}
