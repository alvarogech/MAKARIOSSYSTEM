import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { classContext } from "@/modules/academic/classHub";
import { CreateAnnouncementForm } from "@/modules/academic/components/CreateAnnouncementForm";

export const metadata: Metadata = { title: "Avisos da turma" };

export default async function TurmaAvisosPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await classContext(supabase, classId);
  if (!ctx) notFound();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, published_at")
    .eq("class_id", classId)
    .order("published_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-900">Avisos desta turma</h2>
        <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
          {(announcements ?? []).map((a) => (
            <li key={a.id} className="py-2">
              <p className="font-medium text-neutral-900">{a.title}</p>
              <p className="text-neutral-600">{a.body}</p>
              <p className="text-xs text-neutral-400">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(a.published_at))}</p>
            </li>
          ))}
          {(announcements ?? []).length === 0 ? <li className="py-2 text-neutral-400">Nenhum aviso específico desta turma.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold text-neutral-900">Publicar aviso para esta turma</h2>
        <CreateAnnouncementForm classes={[{ id: classId, name: ctx.name }]} modules={[]} />
      </Card>
    </div>
  );
}
