/**
 * Conquistas pessoais do aluno. Calculadas na leitura, sem tabela: a verdade são as tentativas,
 * respostas e práticas. Sem XP, nível, ranking ou comparação — e nenhuma regra olha nota ou acerto
 * de uma tentativa, só a quantidade de questões diferentes já acertadas.
 */

export interface AttemptFact {
  activityId: string;
  startedAt: string;
  /** Só tentativas enviadas têm data de envio. */
  submittedAt: string | null;
}

export interface AchievementFacts {
  attempts: AttemptFact[];
  /** Para cada questão já acertada (em tentativa enviada), a data do primeiro envio em que acertou. */
  correctQuestionDates: string[];
  practiceDates: string[];
  /** Algum item de material já foi iniciado. */
  contentStarted: boolean;
  /** Nomes das etapas (matérias) com todas as atividades feitas. */
  completedStages: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  /** yyyy-mm-dd ou ISO; null quando a data não é conhecida (ex.: etapa concluída). */
  earnedAt: string | null;
  /** Progresso rumo a esta conquista, quando faz sentido mostrar. */
  progress: { current: number; target: number } | null;
}

export const FIXATION_TIERS = [3, 5, 10] as const;
export const CORRECT_TIERS = [10, 25, 50] as const;

const sortAsc = (dates: string[]) => [...dates].sort((a, b) => a.localeCompare(b));
const nth = (dates: string[], n: number) => sortAsc(dates)[n - 1] ?? null;

function tiers(
  base: string,
  title: (target: number) => string,
  description: (target: number) => string,
  targets: readonly number[],
  count: number,
  dateOfNth: (n: number) => string | null,
): Achievement[] {
  return targets.map((target) => ({
    id: `${base}-${target}`,
    title: title(target),
    description: description(target),
    earned: count >= target,
    earnedAt: count >= target ? dateOfNth(target) : null,
    progress: { current: Math.min(count, target), target },
  }));
}

export function buildAchievements(facts: AchievementFacts): Achievement[] {
  const submitted = facts.attempts.filter((a) => a.submittedAt);

  // Datas de envio por desafio (para "primeira fixação", "revisão" e "fixações diferentes").
  const byActivity = new Map<string, string[]>();
  for (const attempt of submitted) {
    byActivity.set(attempt.activityId, [...(byActivity.get(attempt.activityId) ?? []), attempt.submittedAt!]);
  }
  const firstSubmitPerActivity = [...byActivity.values()].map((dates) => sortAsc(dates)[0]!);
  const secondSubmits = [...byActivity.values()].filter((d) => d.length >= 2).map((d) => sortAsc(d)[1]!);

  const earliestStart = sortAsc(facts.attempts.map((a) => a.startedAt))[0] ?? null;
  const firstSteps = facts.contentStarted || facts.attempts.length > 0;

  const list: Achievement[] = [
    {
      id: "primeiros-passos",
      title: "Primeiros passos",
      description: "Você começou: abriu um material ou um desafio de fixação.",
      earned: firstSteps,
      earnedAt: firstSteps ? earliestStart : null,
      progress: null,
    },
    {
      id: "primeira-fixacao",
      title: "Primeira fixação",
      description: "Você enviou seu primeiro desafio de fixação.",
      earned: submitted.length > 0,
      earnedAt: nth(firstSubmitPerActivity, 1),
      progress: null,
    },
    {
      id: "revisao-realizada",
      title: "Revisão realizada",
      description: "Você repetiu um desafio para fixar melhor.",
      earned: secondSubmits.length > 0,
      earnedAt: nth(secondSubmits, 1),
      progress: null,
    },
    {
      id: "pratica-registrada",
      title: "Prática registrada",
      description: "Você registrou que viveu uma prática.",
      earned: facts.practiceDates.length > 0,
      earnedAt: nth(facts.practiceDates, 1),
      progress: null,
    },
    ...tiers(
      "fixacoes",
      (n) => `${n} desafios de fixação realizados`,
      (n) => `Você concluiu ${n} desafios de fixação diferentes.`,
      FIXATION_TIERS,
      byActivity.size,
      (n) => nth(firstSubmitPerActivity, n),
    ),
    ...tiers(
      "acertos",
      (n) => `${n} questões acertadas`,
      (n) => `Você já acertou ${n} questões diferentes — repetir um desafio não conta duas vezes.`,
      CORRECT_TIERS,
      facts.correctQuestionDates.length,
      (n) => nth(facts.correctQuestionDates, n),
    ),
    ...facts.completedStages.map((name, i) => ({
      id: `etapa-${i}`,
      title: `Etapa concluída: ${name}`,
      description: "Você fez todas as atividades desta etapa.",
      earned: true,
      earnedAt: null,
      progress: null,
    })),
  ];

  return list;
}

/** O que mostrar: tudo o que foi conquistado + só a próxima de cada família com faixas (sem parede de cadeados). */
export function visibleAchievements(all: Achievement[]): { earned: Achievement[]; upNext: Achievement[] } {
  const earned = all.filter((a) => a.earned);
  const upNext: Achievement[] = [];
  const seenFamily = new Set<string>();
  for (const a of all) {
    if (a.earned) continue;
    const family = a.id.includes("-") && /\d+$/.test(a.id) ? a.id.replace(/-\d+$/, "") : a.id;
    if (seenFamily.has(family)) continue;
    seenFamily.add(family);
    upNext.push(a);
  }
  return { earned, upNext };
}
