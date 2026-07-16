import type { Metadata } from "next";
import { can, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateQuestionForm } from "@/modules/content/components/CreateQuestionForm";
import { CreateActivityForm } from "@/modules/content/components/CreateActivityForm";
import { AttachQuestionForm } from "@/modules/content/components/AttachQuestionForm";

export const metadata: Metadata = { title: "Banco de questões e exercícios" };

export default async function QuestoesPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!can(authContext, { resource: "question_bank", action: "manage" })) {
    return (
      <AccessDenied description="Esta área é exclusiva de coordenação, administração e editor de conteúdo." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const [
    { data: lessons },
    { data: modules },
    { data: volumes },
    { data: questions },
    { data: activities },
    { data: activityQuestions },
  ] = await Promise.all([
    supabase.from("lessons").select("id, module_id, name"),
    supabase.from("modules").select("id, volume_id, name"),
    supabase.from("volumes").select("id, name"),
    supabase.from("question_bank").select("id, prompt, type, topic, difficulty").order("created_at", { ascending: false }),
    supabase.from("activities").select("id, lesson_id, title").order("created_at", { ascending: false }),
    supabase.from("activity_questions").select("activity_id, question_id, order_index"),
  ]);

  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));
  const modulesById = new Map((modules ?? []).map((m) => [m.id, m]));
  const lessonsById = new Map((lessons ?? []).map((l) => [l.id, l]));
  const questionsById = new Map((questions ?? []).map((q) => [q.id, q]));

  const lessonLabel = (lessonId: string) => {
    const lesson = lessonsById.get(lessonId);
    if (!lesson) return "Aula";
    const module_ = modulesById.get(lesson.module_id);
    const volume = module_ ? volumesById.get(module_.volume_id) : null;
    return `${volume?.name ?? "Volume"} — ${module_?.name ?? "Módulo"} — ${lesson.name}`;
  };

  const questionsByActivity = new Map<string, string[]>();
  for (const link of activityQuestions ?? []) {
    const list = questionsByActivity.get(link.activity_id) ?? [];
    list.push(questionsById.get(link.question_id)?.prompt ?? link.question_id);
    questionsByActivity.set(link.activity_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Banco de questões e exercícios</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Nunca discursiva. A resposta correta só é revelada ao aluno
          depois do envio do exercício (correção sempre no servidor).
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Nova questão</h2>
        <div className="mt-3">
          <CreateQuestionForm lessons={(lessons ?? []).map((l) => ({ id: l.id, label: lessonLabel(l.id) }))} />
        </div>
        <ul className="mt-4 divide-y divide-neutral-100 text-sm">
          {(questions ?? []).map((q) => (
            <li key={q.id} className="py-1.5 text-neutral-700">
              {q.prompt} <span className="text-neutral-400">({q.type}, {q.difficulty})</span>
            </li>
          ))}
          {(questions ?? []).length === 0 ? <li className="py-1.5 text-neutral-400">Nenhuma questão criada ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Exercícios</h2>
        <div className="mt-3">
          <CreateActivityForm lessons={(lessons ?? []).map((l) => ({ id: l.id, label: lessonLabel(l.id) }))} />
        </div>
        <ul className="mt-4 divide-y divide-neutral-100 text-sm">
          {(activities ?? []).map((a) => (
            <li key={a.id} className="py-2 text-neutral-700">
              <p className="font-medium">{lessonLabel(a.lesson_id)} — {a.title}</p>
              <p className="text-xs text-neutral-400">
                Questões: {(questionsByActivity.get(a.id) ?? []).join("; ") || "nenhuma vinculada ainda"}
              </p>
            </li>
          ))}
          {(activities ?? []).length === 0 ? <li className="py-1.5 text-neutral-400">Nenhum exercício criado ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Vincular questão a um exercício</h2>
        <div className="mt-3">
          <AttachQuestionForm
            activities={(activities ?? []).map((a) => ({ id: a.id, label: `${lessonLabel(a.lesson_id)} — ${a.title}` }))}
            questions={(questions ?? []).map((q) => ({ id: q.id, label: q.prompt }))}
          />
        </div>
      </Card>
    </div>
  );
}
