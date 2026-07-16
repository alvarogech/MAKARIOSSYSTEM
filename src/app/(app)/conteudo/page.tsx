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
    supabase.from("volumes").select("id, name").order("order_index"),
    supabase.from("modules").select("id, volume_id, name, order_index").order("order_index"),
    supabase.from("lessons").select("id, module_id, name, order_index").order("order_index"),
    supabase
      .from("contents")
      .select("id, lesson_id, title, type, classification, status, order_index")
      .order("order_index"),
    supabase.from("activities").select("id, lesson_id, title").order("created_at"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const modulesById = new Map((modules ?? []).map((m) => [m.id, m]));
  const lessonsById = new Map((lessons ?? []).map((l) => [l.id, l]));

  const moduleLabel = (moduleId: string) => {
    const module_ = modulesById.get(moduleId);
    if (!module_) return "Módulo";
    return `${volumesById.get(module_.volume_id)?.name ?? "Volume"} — ${module_.name}`;
  };
  const lessonLabel = (lessonId: string) => {
    const lesson = lessonsById.get(lessonId);
    if (!lesson) return "Aula";
    return `${moduleLabel(lesson.module_id)} — ${lesson.name}`;
  };

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
        <Link href="/conteudo/questoes" className={buttonVariants({ variant: "secondary" })}>
          Banco de questões e exercícios
        </Link>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Módulos</h2>
        <div className="mt-3"><CreateModuleForm volumes={(volumes ?? []).map((v) => ({ id: v.id, name: v.name }))} /></div>
        <ul className="mt-4 divide-y divide-neutral-100 text-sm">
          {(modules ?? []).map((m) => (
            <li key={m.id} className="py-1.5 text-neutral-700">{moduleLabel(m.id)}</li>
          ))}
          {(modules ?? []).length === 0 ? <li className="py-1.5 text-neutral-400">Nenhum módulo criado ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Aulas</h2>
        <div className="mt-3">
          <CreateLessonForm modules={(modules ?? []).map((m) => ({ id: m.id, label: moduleLabel(m.id) }))} />
        </div>
        <ul className="mt-4 divide-y divide-neutral-100 text-sm">
          {(lessons ?? []).map((l) => (
            <li key={l.id} className="py-1.5 text-neutral-700">{lessonLabel(l.id)}</li>
          ))}
          {(lessons ?? []).length === 0 ? <li className="py-1.5 text-neutral-400">Nenhuma aula criada ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Conteúdos</h2>
        <div className="mt-3">
          <CreateContentForm lessons={(lessons ?? []).map((l) => ({ id: l.id, label: lessonLabel(l.id) }))} />
        </div>
        <ul className="mt-4 divide-y divide-neutral-100 text-sm">
          {(contents ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between py-1.5 text-neutral-700">
              <span>
                {lessonLabel(c.lesson_id)} — {c.title}{" "}
                <span className="text-neutral-400">({c.type}, {c.classification}, {c.status})</span>
              </span>
              <PublishContentButton contentId={c.id} currentStatus={c.status} />
            </li>
          ))}
          {(contents ?? []).length === 0 ? <li className="py-1.5 text-neutral-400">Nenhum conteúdo criado ainda.</li> : null}
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
            contents={(contents ?? []).map((c) => ({ id: c.id, label: `${lessonLabel(c.lesson_id)} — ${c.title}` }))}
            activities={(activities ?? []).map((a) => ({ id: a.id, label: `${lessonLabel(a.lesson_id)} — ${a.title}` }))}
          />
        </div>
      </Card>
    </div>
  );
}
