import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Turma" };

export default async function ProfessorTurmaDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "teacher")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Professor." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", authContext.userId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assignment) {
    notFound();
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, location, season_volume_offering_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass) {
    notFound();
  }

  const [{ data: offering }, { data: meetings }, { data: enrollments }, { data: reports }] =
    await Promise.all([
      supabase
        .from("season_volume_offerings")
        .select("volume_id")
        .eq("id", klass.season_volume_offering_id)
        .single(),
      supabase
        .from("class_meetings")
        .select("id, sequence, meeting_date, academic_minutes, status")
        .eq("class_id", classId)
        .order("sequence"),
      supabase
        .from("enrollments")
        .select("id, student_id, status")
        .eq("class_id", classId),
      supabase.from("class_meeting_reports").select("meeting_id").eq("teacher_id", authContext.userId),
    ]);

  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: attendanceCounts } = await supabase
    .from("attendance_records")
    .select("meeting_id")
    .in("meeting_id", (meetings ?? []).map((m) => m.id));
  const recordedMeetingIds = new Set((attendanceCounts ?? []).map((a) => a.meeting_id));
  const reportedMeetingIds = new Set((reports ?? []).map((r) => r.meeting_id));

  const volume = offering
    ? await supabase.from("volumes").select("name").eq("id", offering.volume_id).maybeSingle()
    : { data: null };

  const contentsQuery = offering
    ? await supabase
        .from("contents")
        .select(
          "id, title, type, classification, body, order_index, lesson:lessons(name, module:modules(name, order_index))",
        )
        .eq("volume_id", offering.volume_id)
        .order("order_index")
    : { data: [] };

  const contentIds = (contentsQuery.data ?? []).map((content) => content.id);
  const { data: contentFiles } = contentIds.length
    ? await supabase.from("content_files").select("content_id, file_name, file_url").in("content_id", contentIds)
    : { data: [] };
  const filesByContentId = new Map<string, { file_name: string; file_url: string }[]>();
  for (const file of contentFiles ?? []) {
    const list = filesByContentId.get(file.content_id) ?? [];
    list.push(file);
    filesByContentId.set(file.content_id, list);
  }

  const materials = (contentsQuery.data ?? [])
    .map((content) => ({
      ...content,
      moduleOrder: content.lesson?.module?.order_index ?? 0,
      moduleName: content.lesson?.module?.name ?? null,
      files: filesByContentId.get(content.id) ?? [],
    }))
    .sort((a, b) => a.moduleOrder - b.moduleOrder || a.order_index - b.order_index);

  const apostilas = materials.filter((m) => m.classification !== "exclusivo_professor");
  const slides = materials.filter((m) => m.classification === "exclusivo_professor");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{klass.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {volume.data?.name ?? "Volume"} {klass.location ? `· ${klass.location}` : ""}
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Alunos ({(enrollments ?? []).length})</h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {(enrollments ?? []).map((enrollment) => (
            <li key={enrollment.id} className="py-1.5 text-neutral-700">
              {profilesById.get(enrollment.student_id)?.full_name ?? "Aluno"}{" "}
              <span className="text-neutral-400">({enrollment.status})</span>
            </li>
          ))}
          {(enrollments ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum aluno matriculado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Encontros</h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {(meetings ?? []).map((meeting) => (
            <li key={meeting.id} className="flex items-center justify-between py-2">
              <span className="text-neutral-700">
                Encontro {meeting.sequence}
                {meeting.meeting_date ? ` — ${meeting.meeting_date}` : " — data a definir"}{" "}
                <span className="text-neutral-400">({meeting.academic_minutes} min)</span>
                {recordedMeetingIds.has(meeting.id) ? (
                  <span className="ml-2 text-xs text-success">frequência registrada</span>
                ) : null}
                {reportedMeetingIds.has(meeting.id) ? (
                  <span className="ml-2 text-xs text-success">relatório enviado</span>
                ) : null}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/professor/turmas/${classId}/encontros/${meeting.id}/frequencia`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  Frequência
                </Link>
                <Link
                  href={`/professor/turmas/${classId}/encontros/${meeting.id}/relatorio`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Relatório
                </Link>
              </div>
            </li>
          ))}
          {(meetings ?? []).length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum encontro cadastrado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Materiais da aula</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Conteúdos publicados do volume, organizados por módulo.
        </p>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Apostilas
        </h3>
        <ul className="mt-2 divide-y divide-neutral-100 text-sm">
          {apostilas.map((material) => (
            <MaterialRow key={material.id} material={material} />
          ))}
          {apostilas.length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhuma apostila publicada ainda.</li>
          ) : null}
        </ul>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Slides
        </h3>
        <p className="mt-1 text-xs text-neutral-400">
          Visível apenas para professores e coordenação — nunca aparece na área do aluno.
        </p>
        <ul className="mt-2 divide-y divide-neutral-100 text-sm">
          {slides.map((material) => (
            <MaterialRow key={material.id} material={material} />
          ))}
          {slides.length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum slide publicado ainda.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}

function MaterialRow({
  material,
}: {
  material: {
    id: string;
    title: string;
    type: string;
    body: string | null;
    moduleName: string | null;
    files: { file_name: string; file_url: string }[];
  };
}) {
  const actions =
    material.type === "file" && material.files.length > 0
      ? material.files.map((file) => ({
          label: file.file_name.endsWith("(PPTX)") ? "Baixar PPTX" : file.file_name.endsWith("(PDF)") ? "Abrir PDF" : "Baixar",
          href: file.file_url,
        }))
      : material.type === "link" && material.body
        ? [{ label: "Abrir apresentação", href: material.body }]
        : [];

  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-neutral-700">
      <span>
        {material.title}
        {material.moduleName ? (
          <span className="text-neutral-400"> · {material.moduleName}</span>
        ) : null}
      </span>
      {actions.length > 0 ? (
        <div className="flex gap-2">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {action.label}
            </a>
          ))}
        </div>
      ) : (
        <span className="text-xs text-neutral-400">Sem arquivo disponível</span>
      )}
    </li>
  );
}
