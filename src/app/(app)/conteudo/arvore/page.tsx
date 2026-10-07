import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";

export const metadata: Metadata = { title: "Conteúdo" };

type Indicator = { label: string; state: "ok" | "draft" | "missing" };

function Chip({ indicator }: { indicator: Indicator }) {
  const style =
    indicator.state === "ok"
      ? "bg-green-50 text-green-700"
      : indicator.state === "draft"
        ? "bg-amber-50 text-amber-700"
        : "bg-neutral-100 text-neutral-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {indicator.state === "ok" ? <Check className="size-3" aria-hidden="true" /> : <Minus className="size-3" aria-hidden="true" />}
      {indicator.label}
      {indicator.state === "draft" ? " (rascunho)" : indicator.state === "missing" ? " — falta" : ""}
    </span>
  );
}

/** Árvore Volume › Módulo › Aula com o que já existe de cada coisa. */
export default async function ConteudoArvorePage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!can(auth, { resource: "content", action: "manage" })) {
    return <AccessDenied description="Esta área é exclusiva de coordenação, administração e editor de conteúdo." />;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: volumes }, { data: modules }, { data: lessons }, { data: contents }, { data: files }, { data: activities }] = await Promise.all([
    supabase.from("volumes").select("id, name, order_index").order("order_index"),
    supabase.from("modules").select("id, volume_id, name, order_index").order("order_index"),
    supabase.from("lessons").select("id, module_id, name, order_index").order("order_index"),
    supabase.from("contents").select("id, lesson_id, title, type, classification, status"),
    supabase.from("content_files").select("content_id, file_name"),
    supabase.from("activities").select("id, lesson_id, status"),
  ]);

  const filesByContent = new Map<string, string[]>();
  for (const f of files ?? []) filesByContent.set(f.content_id, [...(filesByContent.get(f.content_id) ?? []), f.file_name]);

  const indicatorsFor = (lessonId: string): Indicator[] => {
    const own = (contents ?? []).filter((c) => c.lesson_id === lessonId);
    const names = (c: (typeof own)[number]) => [c.title, ...(filesByContent.get(c.id) ?? [])].map((n) => n.toLowerCase());
    const stateOf = (matches: (typeof own)): Indicator["state"] =>
      matches.some((c) => c.status === "published") ? "ok" : matches.length > 0 ? "draft" : "missing";

    const apostila = own.filter((c) => names(c).some((n) => n.startsWith("apostila")));
    const slides = own.filter((c) => names(c).some((n) => n.startsWith("slides")));
    const videos = own.filter((c) => c.type === "video");
    const acts = (activities ?? []).filter((a) => a.lesson_id === lessonId);

    return [
      { label: "Apostila", state: stateOf(apostila) },
      { label: "Slides", state: stateOf(slides) },
      { label: "Vídeo", state: stateOf(videos) },
      { label: "Exercício", state: acts.some((a) => a.status === "published") ? "ok" : acts.length > 0 ? "draft" : "missing" },
    ];
  };

  const lessonsByModule = new Map<string, NonNullable<typeof lessons>>();
  for (const l of lessons ?? []) lessonsByModule.set(l.module_id, [...(lessonsByModule.get(l.module_id) ?? []), l]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Conteúdo</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Volume › módulo › aula, com o que já existe de apostila, slides, vídeo e exercício. Verde = publicado; amarelo = em rascunho; cinza = falta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/conteudo" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Criar ou editar no estúdio
          </Link>
          <Link href="/conteudo/revisao" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Revisão de questões
          </Link>
        </div>
      </div>

      {(volumes ?? []).map((volume) => {
        const volumeModules = (modules ?? []).filter((m) => m.volume_id === volume.id);
        const allLessons = volumeModules.flatMap((m) => lessonsByModule.get(m.id) ?? []);
        const complete = allLessons.filter((l) => indicatorsFor(l.id).every((i) => i.state === "ok")).length;
        return (
          <Card key={volume.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">{volume.name}</h2>
              <span className="text-xs text-neutral-500">
                {complete} de {allLessons.length} aulas com tudo publicado
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-neutral-100">
              {volumeModules.map((module_) => {
                const moduleLessons = lessonsByModule.get(module_.id) ?? [];
                return (
                  <li key={module_.id} className="py-2">
                    <p className="text-sm font-medium text-neutral-900">{module_.name}</p>
                    {moduleLessons.length === 0 ? (
                      <p className="text-xs text-danger">Sem aula cadastrada.</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {moduleLessons.map((lesson) => (
                          <li key={lesson.id} className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                            <span className="w-24 shrink-0 text-xs text-neutral-500">{lesson.name}</span>
                            {indicatorsFor(lesson.id).map((indicator) => (
                              <Chip key={indicator.label} indicator={indicator} />
                            ))}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
