import { describe, expect, it } from "vitest";
import { buildAchievements, visibleAchievements, type AchievementFacts } from "@/modules/learning/achievements";
import { buildWeeklyGoal, clampTarget, weekBounds } from "@/modules/learning/weeklyGoal";

const empty: AchievementFacts = { attempts: [], correctQuestionDates: [], practiceDates: [], contentStarted: false, completedStages: [] };
const byId = (facts: AchievementFacts, id: string) => buildAchievements(facts).find((a) => a.id === id)!;

describe("buildAchievements", () => {
  it("aluno sem nada: nenhuma conquista", () => {
    expect(buildAchievements(empty).filter((a) => a.earned)).toHaveLength(0);
  });

  it("primeiros passos: basta ter começado um desafio (mesmo sem enviar)", () => {
    const a = byId({ ...empty, attempts: [{ activityId: "a1", startedAt: "2026-10-08T10:00:00Z", submittedAt: null }] }, "primeiros-passos");
    expect(a.earned).toBe(true);
    expect(a.earnedAt).toBe("2026-10-08T10:00:00Z");
    expect(byId({ ...empty, contentStarted: true }, "primeiros-passos").earned).toBe(true);
  });

  it("primeira fixação só com tentativa enviada", () => {
    const started = { activityId: "a1", startedAt: "2026-10-08T10:00:00Z", submittedAt: null };
    expect(byId({ ...empty, attempts: [started] }, "primeira-fixacao").earned).toBe(false);
    const sent = { ...started, submittedAt: "2026-10-08T10:20:00Z" };
    const a = byId({ ...empty, attempts: [sent] }, "primeira-fixacao");
    expect(a.earned).toBe(true);
    expect(a.earnedAt).toBe("2026-10-08T10:20:00Z");
  });

  it("revisão realizada: repetir o MESMO desafio; dois desafios diferentes não contam", () => {
    const t = (activityId: string, submittedAt: string) => ({ activityId, startedAt: submittedAt, submittedAt });
    expect(byId({ ...empty, attempts: [t("a1", "2026-10-08T10:00:00Z"), t("a2", "2026-10-09T10:00:00Z")] }, "revisao-realizada").earned).toBe(false);
    const again = byId({ ...empty, attempts: [t("a1", "2026-10-08T10:00:00Z"), t("a1", "2026-10-10T10:00:00Z")] }, "revisao-realizada");
    expect(again.earned).toBe(true);
    expect(again.earnedAt).toBe("2026-10-10T10:00:00Z");
  });

  it("prática registrada", () => {
    expect(byId(empty, "pratica-registrada").earned).toBe(false);
    expect(byId({ ...empty, practiceDates: ["2026-10-12T09:00:00Z"] }, "pratica-registrada").earned).toBe(true);
  });

  it("desafios diferentes em faixas 3, 5 e 10, com a data em que cada faixa foi atingida", () => {
    const attempts = ["a1", "a2", "a3", "a4"].map((id, i) => ({ activityId: id, startedAt: `2026-10-0${i + 1}T10:00:00Z`, submittedAt: `2026-10-0${i + 1}T11:00:00Z` }));
    const all = buildAchievements({ ...empty, attempts });
    expect(all.find((a) => a.id === "fixacoes-3")?.earned).toBe(true);
    expect(all.find((a) => a.id === "fixacoes-3")?.earnedAt).toBe("2026-10-03T11:00:00Z");
    expect(all.find((a) => a.id === "fixacoes-5")?.earned).toBe(false);
    expect(all.find((a) => a.id === "fixacoes-5")?.progress).toEqual({ current: 4, target: 5 });
  });

  it("questões acertadas contam questões diferentes (a lista já vem sem repetição)", () => {
    const dates = Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`);
    const all = buildAchievements({ ...empty, correctQuestionDates: dates });
    expect(all.find((a) => a.id === "acertos-10")?.earned).toBe(true);
    expect(all.find((a) => a.id === "acertos-10")?.earnedAt).toBe("2026-10-10T10:00:00Z");
    expect(all.find((a) => a.id === "acertos-25")?.earned).toBe(false);
  });

  it("etapas concluídas viram conquistas com o nome da matéria", () => {
    const all = buildAchievements({ ...empty, completedStages: ["Fé"] });
    expect(all.find((a) => a.title === "Etapa concluída: Fé")?.earned).toBe(true);
  });
});

describe("visibleAchievements", () => {
  it("mostra só a próxima faixa de cada família, sem parede de cadeados", () => {
    const { earned, upNext } = visibleAchievements(buildAchievements(empty));
    expect(earned).toHaveLength(0);
    const ids = upNext.map((a) => a.id);
    expect(ids).toContain("fixacoes-3");
    expect(ids).not.toContain("fixacoes-5");
    expect(ids).toContain("acertos-10");
    expect(ids).not.toContain("acertos-25");
  });
});

describe("meta semanal", () => {
  it("a semana vai de segunda a domingo no horário de São Paulo", () => {
    // 2026-10-07 é quarta-feira.
    const b = weekBounds(new Date("2026-10-07T15:00:00Z"));
    expect(b.startKey).toBe("2026-10-05");
    expect(b.endIso).toBe("2026-10-12T00:00:00-03:00");
    // Domingo 23h em São Paulo ainda é a mesma semana; segunda 00h30 já é a próxima.
    expect(weekBounds(new Date("2026-10-12T02:00:00Z")).startKey).toBe("2026-10-05");
    expect(weekBounds(new Date("2026-10-12T03:30:00Z")).startKey).toBe("2026-10-12");
  });

  it("conta desafios enviados e práticas só dentro da semana", () => {
    const bounds = weekBounds(new Date("2026-10-07T15:00:00Z"));
    const view = buildWeeklyGoal({
      enabled: true,
      target: 3,
      submittedAts: ["2026-10-06T12:00:00Z", "2026-09-30T12:00:00Z"],
      practicedAts: ["2026-10-07T12:00:00Z"],
      bounds,
    });
    expect(view.done).toBe(2);
    expect(view.reached).toBe(false);
  });

  it("meta desligada nunca é 'alcançada' e o alvo fica entre 1 e 5", () => {
    const bounds = weekBounds(new Date("2026-10-07T15:00:00Z"));
    const off = buildWeeklyGoal({ enabled: false, target: 1, submittedAts: ["2026-10-06T12:00:00Z"], practicedAts: [], bounds });
    expect(off.reached).toBe(false);
    expect([clampTarget(0), clampTarget(9), clampTarget(Number.NaN), clampTarget(3)]).toEqual([1, 5, 2, 3]);
  });
});
