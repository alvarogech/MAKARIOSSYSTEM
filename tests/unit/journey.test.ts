import { describe, expect, it } from "vitest";
import { buildStage, buildVolumeJourney, type StageInput } from "@/modules/learning/journey";

const base = (over: Partial<StageInput> = {}): StageInput => ({
  moduleId: "m1",
  name: "Fé",
  meeting: null,
  material: { total: 0, released: 0, completed: 0 },
  fixation: null,
  practice: null,
  ...over,
});

describe("buildStage", () => {
  it("sem atividades e encontro futuro: em breve", () => {
    const s = buildStage(base({ meeting: { date: "2026-10-20", past: false, attendance: "futuro" } }), 1, "e1");
    expect(s.state).toBe("em_breve");
    expect(s.actionsTotal).toBe(0);
  });

  it("sem atividades e encontro realizado: concluída (nada a fazer)", () => {
    const s = buildStage(base({ meeting: { date: "2026-10-06", past: true, attendance: "presente" } }), 1, "e1");
    expect(s.state).toBe("concluida");
  });

  it("fixação disponível e não iniciada: disponível, com link para o exercício", () => {
    const s = buildStage(base({ fixation: { activityId: "a1", status: "nenhuma" } }), 2, "e1");
    expect(s.state).toBe("disponivel");
    expect(s.steps[0]?.href).toBe("/exercicios/a1?enrollmentId=e1");
  });

  it("fixação em andamento: etapa em andamento", () => {
    const s = buildStage(base({ fixation: { activityId: "a1", status: "em_andamento" } }), 1, "e1");
    expect(s.state).toBe("em_andamento");
  });

  it("uma das duas atividades feita: em andamento (1 de 2)", () => {
    const s = buildStage(base({ fixation: { activityId: "a1", status: "enviada" }, practice: { done: false } }), 1, "e1");
    expect(s.state).toBe("em_andamento");
    expect([s.actionsDone, s.actionsTotal]).toEqual([1, 2]);
  });

  it("todas as atividades feitas: concluída", () => {
    const s = buildStage(
      base({ material: { total: 2, released: 2, completed: 2 }, fixation: { activityId: "a1", status: "enviada" }, practice: { done: true } }),
      1,
      "e1",
    );
    expect(s.state).toBe("concluida");
  });

  it("material liberado é só apoio: link para consulta, sem contar como atividade nem como 'a fazer'", () => {
    const s = buildStage(base({ material: { total: 3, released: 3, completed: 0 }, fixation: { activityId: "a1", status: "nenhuma" } }), 1, "e1");
    const mat = s.steps.find((x) => x.kind === "material");
    expect(mat?.support).toBe(true);
    expect(mat?.href).toBe("/meus-volumes/e1");
    expect(mat?.state).not.toBe("pendente");
    expect([s.actionsDone, s.actionsTotal]).toEqual([0, 1]);
  });

  it("só material liberado, sem fixação nem prática: a etapa não fica pendente por causa do material", () => {
    const s = buildStage(base({ material: { total: 2, released: 2, completed: 0 }, meeting: { date: "2026-10-06", past: true, attendance: "presente" } }), 1, "e1");
    expect(s.actionsTotal).toBe(0);
    expect(s.state).toBe("concluida");
  });

  it("material ainda não liberado não conta como ação nem vira link", () => {
    const s = buildStage(base({ material: { total: 3, released: 0, completed: 0 } }), 1, "e1");
    expect(s.actionsTotal).toBe(0);
    expect(s.steps[0]?.state).toBe("indisponivel");
    expect(s.steps[0]?.href).toBeNull();
  });

  it("encontro sem presença registrada aponta para Minha frequência, sem bloquear a etapa", () => {
    const s = buildStage(
      base({ meeting: { date: "2026-10-06", past: true, attendance: "sem_registro" }, fixation: { activityId: "a1", status: "nenhuma" } }),
      1,
      "e1",
    );
    expect(s.steps[0]?.href).toBe("/minha-frequencia");
    expect(s.state).toBe("disponivel");
  });
});

describe("buildVolumeJourney", () => {
  const stages: StageInput[] = [
    base({ moduleId: "a", name: "Deus", fixation: { activityId: "f1", status: "enviada" }, practice: { done: true } }),
    base({ moduleId: "b", name: "Criação e Queda", fixation: { activityId: "f2", status: "em_andamento" } }),
    base({ moduleId: "c", name: "Redenção", meeting: { date: "2026-10-27", past: false, attendance: "futuro" } }),
  ];

  it("foca a primeira etapa com algo a fazer e sugere continuar o que está em andamento", () => {
    const j = buildVolumeJourney({ enrollmentId: "e1", volumeName: "Essência", stages });
    expect(j.concluded).toBe(1);
    expect(j.currentIndex).toBe(1);
    expect(j.next?.cta).toBe("Continuar");
    expect(j.next?.href).toBe("/exercicios/f2?enrollmentId=e1");
  });

  it("tudo concluído: sem etapa em foco e sem próximo passo", () => {
    const j = buildVolumeJourney({ enrollmentId: "e1", volumeName: "Essência", stages: [stages[0]!] });
    expect(j.currentIndex).toBe(-1);
    expect(j.next).toBeNull();
  });

  it("sem nada disponível, o foco vai para a próxima aula", () => {
    const j = buildVolumeJourney({ enrollmentId: "e1", volumeName: "Essência", stages: [stages[2]!] });
    expect(j.currentIndex).toBe(0);
    expect(j.next).toBeNull();
  });
});
