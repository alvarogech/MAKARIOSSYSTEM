import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { EnrollmentForm } from "@/modules/academic/components/EnrollmentForm";
import { EnrollmentsTable, type EnrollmentTableRow } from "@/modules/academic/components/EnrollmentsTable";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/enrollmentStatusLabels";
import { enrollmentStatusValues } from "@/modules/academic/schemas";

export const metadata: Metadata = { title: "Matrículas" };

const PAGE_SIZE = 100;
const fieldClass = "rounded-[var(--radius-sm)] border border-neutral-300 bg-white px-2 py-1.5 text-sm";

export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; volume?: string; turma?: string; status?: string; pagina?: string }>;
}) {
  const { q, volume: volumeFilter, turma: classFilter, status: statusFilter, pagina } = await searchParams;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const [
    { data: offerings },
    { data: volumes },
    { data: seasons },
    { data: classes },
    { data: enrollments },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("season_volume_offerings").select("id, season_id, volume_id"),
    supabase.from("volumes").select("id, name"),
    supabase.from("seasons").select("id, name"),
    supabase.from("classes").select("id, name, season_volume_offering_id"),
    supabase
      .from("enrollments")
      .select("id, student_id, season_volume_offering_id, class_id, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, is_demo"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const seasonsById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const volumeNamesById = Object.fromEntries(
    (volumes ?? []).map((v) => [v.id, v.name]),
  );
  const classesById = new Map((classes ?? []).map((c) => [c.id, c]));
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const classesByOffering = new Map<string, { id: string; name: string }[]>();
  for (const klass of classes ?? []) {
    const list = classesByOffering.get(klass.season_volume_offering_id) ?? [];
    list.push({ id: klass.id, name: klass.name });
    classesByOffering.set(klass.season_volume_offering_id, list);
  }

  const offeringLabel = (offeringId: string) => {
    const offering = (offerings ?? []).find((o) => o.id === offeringId);
    if (!offering) return "Oferta";
    const volume = volumesById.get(offering.volume_id)?.name ?? "Volume";
    const season = seasonsById.get(offering.season_id)?.name ?? "Temporada";
    return `${volume} — ${season}`;
  };

  const needle = (q ?? "").trim().toLowerCase();
  const offeringVolume = new Map((offerings ?? []).map((o) => [o.id, o.volume_id]));
  const rows: EnrollmentTableRow[] = (enrollments ?? [])
    .filter((e) => !profilesById.get(e.student_id)?.is_demo)
    .map((e) => ({
      id: e.id,
      studentName: profilesById.get(e.student_id)?.full_name ?? "Aluno",
      email: profilesById.get(e.student_id)?.email ?? null,
      volume: volumesById.get(offeringVolume.get(e.season_volume_offering_id) ?? "")?.name ?? "Volume",
      className: classesById.get(e.class_id)?.name ?? "Turma",
      classId: e.class_id,
      status: e.status,
      offeringId: e.season_volume_offering_id,
      classesInSameOffering: classesByOffering.get(e.season_volume_offering_id) ?? [],
    }));
  const filtered = rows
    .filter((r) => !needle || r.studentName.toLowerCase().includes(needle) || (r.email ?? "").toLowerCase().includes(needle))
    .filter((r) => !volumeFilter || offeringVolume.get(r.offeringId) === volumeFilter)
    .filter((r) => !classFilter || r.classId === classFilter)
    .filter((r) => !statusFilter || r.status === statusFilter)
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
  const page = Math.max(1, Number(pagina) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">
          Nova matrícula
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Um aluno pode ter matrículas simultâneas em mais de um volume. A
          matrícula é bloqueada quando o pré-requisito do volume não foi
          concluído — a coordenação pode autorizar uma exceção justificada.
        </p>
        <div className="mt-4">
          <EnrollmentForm
            offerings={(offerings ?? []).map((o) => ({
              id: o.id,
              label: offeringLabel(o.id),
            }))}
            classes={(classes ?? []).map((c) => ({
              id: c.id,
              label: `${c.name} — ${offeringLabel(c.season_volume_offering_id)}`,
              offeringId: c.season_volume_offering_id,
            }))}
            volumeNamesById={volumeNamesById}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Matrículas registradas</h2>
          <p className="text-xs text-neutral-500">
            Busque por nome ou e-mail, filtre por volume, turma ou status e use as caixas para agir em várias de uma vez. Contas de
            demonstração não aparecem.
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Buscar
            <input name="q" defaultValue={q ?? ""} placeholder="Nome ou e-mail" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Volume
            <select name="volume" defaultValue={volumeFilter ?? ""} className={fieldClass}>
              <option value="">Todos</option>
              {(volumes ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Turma
            <select name="turma" defaultValue={classFilter ?? ""} className={fieldClass}>
              <option value="">Todas</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Status
            <select name="status" defaultValue={statusFilter ?? ""} className={fieldClass}>
              <option value="">Todos</option>
              {enrollmentStatusValues.map((value) => (
                <option key={value} value={value}>
                  {ENROLLMENT_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="pb-1.5 text-brand-blue hover:underline">
            Filtrar
          </button>
        </form>

        <p className="text-xs text-neutral-500">
          {filtered.length} matrícula(s)
          {filtered.length > PAGE_SIZE ? ` · mostrando ${start + 1} a ${Math.min(start + PAGE_SIZE, filtered.length)}` : ""}
        </p>

        <EnrollmentsTable
          rows={pageRows}
          classOptions={(classes ?? []).map((c) => ({ id: c.id, name: c.name, offeringId: c.season_volume_offering_id }))}
        />

        {filtered.length > PAGE_SIZE ? (
          <div className="flex gap-4 text-sm">
            {page > 1 ? (
              <a className="text-brand-blue hover:underline" href={`?${new URLSearchParams({ q: q ?? "", volume: volumeFilter ?? "", turma: classFilter ?? "", status: statusFilter ?? "", pagina: String(page - 1) })}`}>
                ← Anteriores
              </a>
            ) : null}
            {start + PAGE_SIZE < filtered.length ? (
              <a className="text-brand-blue hover:underline" href={`?${new URLSearchParams({ q: q ?? "", volume: volumeFilter ?? "", turma: classFilter ?? "", status: statusFilter ?? "", pagina: String(page + 1) })}`}>
                Próximas →
              </a>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
