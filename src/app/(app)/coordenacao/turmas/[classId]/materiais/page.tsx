import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classContext } from "@/modules/academic/classHub";
import { classificationLabel, contentTypeLabel, statusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Materiais da turma" };

/** Materiais e exercícios do volume desta turma, por matéria. */
export default async function TurmaMateriaisPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await classContext(supabase, classId);
  if (!ctx) notFound();

  const { data: modules } = await supabase.from("modules").select("id, name, order_index").eq("volume_id", ctx.volumeId).order("order_index");
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length ? await supabase.from("lessons").select("id, module_id, name").in("module_id", moduleIds) : { data: [] };
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const [{ data: contents }, { data: activities }] = lessonIds.length
    ? await Promise.all([
        supabase.from("contents").select("id, lesson_id, title, type, classification, status").in("lesson_id", lessonIds).order("order_index"),
        supabase.from("activities").select("id, lesson_id, title, status").in("lesson_id", lessonIds),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">Materiais do volume desta turma. Para criar ou editar, use o estúdio de conteúdo.</p>
        <Link href="/conteudo" className="text-sm font-medium text-brand-blue hover:underline">
          Abrir o estúdio de conteúdo →
        </Link>
      </div>
      {(modules ?? []).map((module_) => {
        const lessonIdsOfModule = new Set((lessons ?? []).filter((l) => l.module_id === module_.id).map((l) => l.id));
        const moduleContents = (contents ?? []).filter((c) => lessonIdsOfModule.has(c.lesson_id));
        const moduleActivities = (activities ?? []).filter((a) => lessonIdsOfModule.has(a.lesson_id));
        return (
          <Card key={module_.id} className="flex flex-col gap-1 p-4">
            <h2 className="font-semibold text-neutral-900">{module_.name}</h2>
            {moduleContents.length === 0 && moduleActivities.length === 0 ? (
              <p className="text-sm text-danger">Sem material nem exercício ainda.</p>
            ) : (
              <ul className="text-sm text-neutral-700">
                {moduleContents.map((c) => (
                  <li key={c.id}>
                    {c.title} <span className="text-neutral-400">· {contentTypeLabel(c.type)} · {classificationLabel(c.classification)} · {statusLabel(c.status).toLowerCase()}</span>
                  </li>
                ))}
                {moduleActivities.map((a) => (
                  <li key={a.id}>
                    {a.title} <span className="text-neutral-400">· exercício · {statusLabel(a.status).toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
