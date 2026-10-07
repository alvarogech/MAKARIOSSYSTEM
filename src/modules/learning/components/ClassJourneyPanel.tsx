import { Card } from "@/components/ui/Card";
import type { ClassJourney } from "../classJourney";

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs text-neutral-600">
        <span>{label}</span>
        <span className="font-medium text-neutral-800">
          {done} de {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label}
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
      >
        <div className="h-full rounded-full bg-brand-blue" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Jornada da turma: participação por matéria, dúvidas recorrentes e o que está liberado ou pendente de publicação.
 * Só agregados — sem nome de aluno, sem notas privadas e sem gabarito. Quando não há dado suficiente diz "Sem dados".
 */
export function ClassJourneyPanel({ journey }: { journey: ClassJourney | null }) {
  if (!journey) {
    return (
      <Card>
        <h2 className="font-semibold text-neutral-900">Jornada da turma</h2>
        <p className="mt-1 text-sm text-neutral-500">Sem dados no momento.</p>
      </Card>
    );
  }

  const withActivity = journey.modules.filter((m) => m.activitiesPublished > 0 || m.challengesPublished > 0);
  const pending = journey.modules.filter((m) => m.activitiesPending > 0 || m.challengesPending > 0);
  const revisit = [...new Set(journey.doubts.map((d) => d.moduleName))];

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="font-semibold text-neutral-900">Jornada da turma</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Números da turma toda, nunca de um aluno em particular. {journey.students} {journey.students === 1 ? "aluno ativo" : "alunos ativos"}.
        </p>
      </div>

      <section aria-labelledby="participacao">
        <h3 id="participacao" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Participação por matéria
        </h3>
        {withActivity.length === 0 || journey.students === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">Sem dados — ainda não há desafio publicado ou aluno ativo nesta turma.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {withActivity.map((m) => (
              <li key={m.moduleId} className="rounded-[var(--radius-sm)] border border-neutral-100 p-3">
                <p className="text-sm font-medium text-neutral-900">{m.name}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {m.activitiesPublished > 0 ? <Bar done={m.studentsDoneActivity} total={journey.students} label="Concluíram o desafio de fixação" /> : null}
                  {m.challengesPublished > 0 ? <Bar done={m.studentsDonePractice} total={journey.students} label="Registraram a prática" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="duvidas">
        <h3 id="duvidas" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Questões com dúvida recorrente
        </h3>
        {journey.doubts.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            Sem dados suficientes — aparecem quando pelo menos 5 alunos responderam e boa parte errou a primeira resposta.
          </p>
        ) : (
          <>
            <ul className="mt-2 flex flex-col gap-2">
              {journey.doubts.map((d) => (
                <li key={d.questionId} className="rounded-[var(--radius-sm)] border border-neutral-100 p-3 text-sm">
                  <p className="text-neutral-900">{d.prompt}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {d.moduleName} · {d.wrong} de {d.answered} erraram na primeira resposta
                  </p>
                </li>
              ))}
            </ul>
            {revisit.length > 0 ? (
              <p className="mt-2 text-sm text-neutral-700">
                <strong>Conteúdos a retomar:</strong> {revisit.join(", ")}.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="publicacao">
        <h3 id="publicacao" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Atividades liberadas e pendentes
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
          <li>
            Liberadas aos alunos: {journey.modules.reduce((n, m) => n + m.activitiesPublished, 0)} desafio(s) de fixação ·{" "}
            {journey.modules.reduce((n, m) => n + m.challengesPublished, 0)} prática(s)
          </li>
          {pending.length > 0 ? (
            <li>
              Aguardando publicação pela coordenação:{" "}
              {pending
                .map((m) => `${m.name} (${[m.activitiesPending ? `${m.activitiesPending} desafio(s)` : null, m.challengesPending ? `${m.challengesPending} prática(s)` : null].filter(Boolean).join(" + ")})`)
                .join("; ")}
            </li>
          ) : (
            <li className="text-neutral-500">Nada aguardando publicação.</li>
          )}
        </ul>
      </section>
    </Card>
  );
}
