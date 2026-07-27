import type { Metadata } from "next";
import Link from "next/link";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateModuleForm } from "@/modules/content/components/CreateModuleForm";
import { CreateLessonForm } from "@/modules/content/components/CreateLessonForm";
import { CreateContentForm } from "@/modules/content/components/CreateContentForm";
import { CreateReleaseRuleForm } from "@/modules/content/components/CreateReleaseRuleForm";
import { PublishContentButton } from "@/modules/content/components/PublishContentButton";

export const metadata: Metadata = { title: "Estúdio de conteúdo" };

export default async function ConteudoAreaPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!authContext || !can(authContext, { resource: "content", action: "manage" })) {
    return (
      <AccessDenied description="Esta área é exclusiva de coordenação, administração e editor de conteúdo." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const [
    { data: volumes },
    { data: modules },
    { data: lessons },
    { data: contents },
    { data: activities },
  ] = await Promise.all([
    supabase.from("volumes").select("id, name, order_index").order("order_index"),
    supabase.from("modules").select("id, volume_id, name, order_index"),
    supabase.from("lessons").select("id, module_id, name, order_index"),
    supabase
      .from("contents")
      .select("id, lesson_id, title, type, classification, status, order_index"),
    supabase.from("activities").select("id, lesson_id, title").order("created_at"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));

  // A query original ordenava só por `order_index`, que reinicia em 1 a
  // cada volume/módulo — o resultado intercalava Essência/Caminho/Voz em
  // vez de agrupar. Aqui ordenamos pela hierarquia real (volume → módulo →
  // aula → conteúdo) antes de montar qualquer lista ou dropdown.
  const sortedModules = [...(modules ?? [])].sort((a, b) => {
    const volA = volumesById.get(a.volume_id)?.order_index ?? 0;
    const volB = volumesById.get(b.volume_id)?.order_index ?? 0;
    return volA - volB || a.order_index - b.order_index;
  });
  const modulesById = new Map(sortedModules.map((m) => [m.id, m]));
  const moduleIndex = new Map(sortedModules.map((m, i) => [m.id, i]));

  const moduleLabel = (moduleId: string) => {
    const module_ = modulesById.get(moduleId);
    if (!module_) return "Módulo";
    return `${volumesById.get(module_.volume_id)?.name ?? "Volume"} — ${module_.name}`;
  };

  const sortedLessons = [...(lessons ?? [])].sort((a, b) => {
    const modA = moduleIndex.get(a.module_id) ?? 0;
    const modB = moduleIndex.get(b.module_id) ?? 0;
    return modA - modB || a.order_index - b.order_index;
  });
  const lessonsById = new Map(sortedLessons.map((l) => [l.id, l]));
  const lessonIndex = new Map(sortedLessons.map((l, i) => [l.id, i]));

  const lessonLabel = (lessonId: string) => {
    const lesson = lessonsById.get(lessonId);
    if (!lesson) return "Aula";
    return `${moduleLabel(lesson.module_id)} — ${lesson.name}`;
  };

  const sortedContents = [...(contents ?? [])].sort((a, b) => {
    const lesA = lessonIndex.get(a.lesson_id) ?? 0;
    const lesB = lessonIndex.get(b.lesson_id) ?? 0;
    return lesA - lesB || a.order_index - b.order_index;
  });
  const sortedActivities = [...(activities ?? [])].sort(
    (a, b) => (lessonIndex.get(a.lesson_id) ?? 0) - (lessonIndex.get(b.lesson_id) ?? 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Estúdio de conteúdo</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Estrutura Volume → Módulo → Aula → Conteúdo, regras de
            liberação e exercícios (banco de questões em página separada).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/conteudo/questoes" className={buttonVariants({ variant: "secondary" })}>
            Banco de questões e exercícios
          </Link>
          <Link href="/conteudo/avaliacoes" className={buttonVariants({ variant: "secondary" })}>
            Avaliações
          </Link>
        </div>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Módulos</h2>
        <div className="mt-3">
          <CreateModuleForm volumes={(volumes ?? []).map((v) => ({ id: v.id, name: v.name }))} />
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {(volumes ?? []).map((volume) => {
            const volumeModules = sortedModules.filter((m) => m.volume_id === volume.id);
            if (volumeModules.length === 0) return null;
            return (
              <div key={volume.id}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {volume.name}
                </h3>
                <ul className="mt-1 divide-y divide-neutral-100 text-sm">
                  {volumeModules.map((m) => (
                    <li key={m.id} className="py-1.5 text-neutral-700">
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {sortedModules.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum módulo criado ainda.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Aulas</h2>
        <div className="mt-3">
          <CreateLessonForm
            modules={(volumes ?? []).map((volume) => ({
              groupLabel: volume.name,
              options: sortedModules
                .filter((m) => m.volume_id === volume.id)
                .map((m) => ({ id: m.id, label: m.name })),
            }))}
          />
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {sortedModules.map((module_) => {
            const moduleLessons = sortedLessons.filter((l) => l.module_id === module_.id);
            if (moduleLessons.length === 0) return null;
            return (
              <div key={module_.id}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {moduleLabel(module_.id)}
                </h3>
                <ul className="mt-1 divide-y divide-neutral-100 text-sm">
                  {moduleLessons.map((l) => (
                    <li key={l.id} className="py-1.5 text-neutral-700">
                      {l.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {sortedLessons.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhuma aula criada ainda.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Conteúdos</h2>
        <div className="mt-3">
          <CreateContentForm
            lessons={sortedModules.map((module_) => ({
              groupLabel: moduleLabel(module_.id),
              options: sortedLessons
                .filter((l) => l.module_id === module_.id)
                .map((l) => ({ id: l.id, label: l.name })),
            }))}
          />
        </div>
        <ul className="mt-4 divide-y divide-neutral-100 text-sm">
          {sortedContents.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-1.5 text-neutral-700">
              <span>
                {lessonLabel(c.lesson_id)} — {c.title}{" "}
                <span className="text-neutral-400">({c.type}, {c.classification}, {c.status})</span>
              </span>
              <PublishContentButton contentId={c.id} currentStatus={c.status} />
            </li>
          ))}
          {sortedContents.length === 0 ? (
            <li className="py-1.5 text-neutral-400">Nenhum conteúdo criado ainda.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Regras de liberação</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Um conteúdo sem nenhuma regra fica liberado imediatamente. Mais
          de uma regra no mesmo conteúdo funciona como &quot;qualquer uma
          libera&quot;.
        </p>
        <div className="mt-3">
          <CreateReleaseRuleForm
            contents={sortedModules.flatMap((module_) => {
              const moduleContents = sortedContents.filter(
                (c) => lessonsById.get(c.lesson_id)?.module_id === module_.id,
              );
              return moduleContents.length === 0
                ? []
                : [
                    {
                      groupLabel: moduleLabel(module_.id),
                      options: moduleContents.map((c) => ({
                        id: c.id,
                        label: `${lessonLabel(c.lesson_id)} — ${c.title}`,
                      })),
                    },
                  ];
            })}
            activities={sortedModules.flatMap((module_) => {
              const moduleActivities = sortedActivities.filter(
                (a) => lessonsById.get(a.lesson_id)?.module_id === module_.id,
              );
              return moduleActivities.length === 0
                ? []
                : [
                    {
                      groupLabel: moduleLabel(module_.id),
                      options: moduleActivities.map((a) => ({
                        id: a.id,
                        label: `${lessonLabel(a.lesson_id)} — ${a.title}`,
                      })),
                    },
                  ];
            })}
          />
        </div>
      </Card>
    </div>
  );
}
