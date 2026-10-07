import type { Metadata } from "next";
import Link from "next/link";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { ChallengeCard } from "@/modules/learning/components/ChallengeCard";

export const metadata: Metadata = { title: "Meu aprendizado" };

type Status = "disponivel" | "em_andamento" | "concluido";
const STATUS_LABEL: Record<Status, string> = {
  disponivel: "Disponível",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};
const STATUS_STYLE: Record<Status, string> = {
  disponivel: "bg-brand-blue-light text-brand-blue",
  em_andamento: "bg-amber-50 text-amber-700",
  concluido: "bg-green-50 text-green-700",
};

export default async function MeuAprendizadoPage() {
  const auth = await getAuthContext();
  if (!auth) return null;
  if (!canAccessArea(auth, "student")) {
    return <AccessDenied description="Esta área é exclusiva do perfil Aluno." />;
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, season_volume_offering_id")
    .eq("student_id", auth.userId)
    .in("status", ["active", "regularization", "approved"]);

  const offeringIds = (enrollments ?? []).map((e) => e.season_volume_offering_id);
  const { data: offerings } = offeringIds.length
    ? await supabase.from("season_volume_offerings").select("id, volume_id").in("id", offeringIds)
    : { data: [] };
  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];

  const [{ data: volumes }, { data: modules }] = volumeIds.length
    ? await Promise.all([
        supabase.from("volumes").select("id, name").in("id", volumeIds),
        supabase.from("modules").select("id, volume_id, name, order_index").in("volume_id", volumeIds).order("order_index"),
      ])
    : [{ data: [] }, { data: [] }];
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons } = moduleIds.length
    ? await supabase.from("lessons").select("id, module_id, name, order_index").in("module_id", moduleIds).order("order_index")
    : { data: [] };

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const [{ data: activities }, { data: challenges }, { data: attempts }, { data: completions }] = lessonIds.length
    ? await Promise.all([
        supabase.from("activities").select("id, lesson_id, title").eq("status", "published").in("lesson_id", lessonIds),
        supabase.from("practice_challenges").select("id, lesson_id, prompt").eq("status", "published").in("lesson_id", lessonIds),
        supabase
          .from("activity_attempts")
          .select("enrollment_id, activity_id, status")
          .in("enrollment_id", enrollmentIds),
        supabase
          .from("challenge_completions")
          .select("enrollment_id, challenge_id, private_note")
          .in("enrollment_id", enrollmentIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const offeringById = new Map((offerings ?? []).map((o) => [o.id, o]));

  const sections = (enrollments ?? [])
    .map((enrollment) => {
      const volumeId = offeringById.get(enrollment.season_volume_offering_id)?.volume_id;
      const volume = (volumes ?? []).find((v) => v.id === volumeId);
      const rows = (modules ?? [])
        .filter((m) => m.volume_id === volumeId)
        .map((module_) => {
          const lessonIdsOfModule = new Set((lessons ?? []).filter((l) => l.module_id === module_.id).map((l) => l.id));
          const activity = (activities ?? []).find((a) => lessonIdsOfModule.has(a.lesson_id));
          const challenge = (challenges ?? []).find((c) => lessonIdsOfModule.has(c.lesson_id));
          if (!activity && !challenge) return null;

          const own = (attempts ?? []).filter((a) => a.enrollment_id === enrollment.id && a.activity_id === activity?.id);
          const status: Status = own.some((a) => a.status === "in_progress")
            ? "em_andamento"
            : own.some((a) => a.status === "submitted")
              ? "concluido"
              : "disponivel";
          const completion = (completions ?? []).find(
            (c) => c.enrollment_id === enrollment.id && c.challenge_id === challenge?.id,
          );
          return { module_, activity, challenge, status, completion };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      return { enrollment, volume, rows };
    })
    .filter((section) => section.rows.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Meu aprendizado</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Exercícios curtos de fixação e desafios práticos de cada matéria. Nada aqui vale nota: serve para fixar o que você
          estudou. Se errar, tudo bem — você vê a explicação e onde revisar na apostila.
        </p>
      </div>

      {sections.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            Ainda não há exercícios liberados para você. Quando a coordenação liberar o de uma matéria, ele aparece aqui.
          </p>
        </Card>
      ) : null}

      {sections.map(({ enrollment, volume, rows }) => (
        <section key={enrollment.id} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-neutral-900">{volume?.name ?? "Volume"}</h2>
          {rows.map(({ module_, activity, challenge, status, completion }) => (
            <Card key={module_.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-neutral-900">{module_.name}</h3>
                {activity ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                ) : null}
              </div>

              {activity ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-neutral-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Desafio de fixação</p>
                    <p className="text-xs text-neutral-500">5 questões · uma por vez · salva sozinho</p>
                  </div>
                  <Link
                    href={`/exercicios/${activity.id}?enrollmentId=${enrollment.id}`}
                    className={buttonVariants({ variant: status === "concluido" ? "secondary" : "primary", size: "sm" })}
                  >
                    {status === "concluido" ? "Rever ou repetir" : status === "em_andamento" ? "Continuar" : "Começar"}
                  </Link>
                </div>
              ) : null}

              {challenge ? (
                <ChallengeCard
                  enrollmentId={enrollment.id}
                  challengeId={challenge.id}
                  prompt={challenge.prompt}
                  practiced={Boolean(completion)}
                  note={completion?.private_note ?? ""}
                />
              ) : null}
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
