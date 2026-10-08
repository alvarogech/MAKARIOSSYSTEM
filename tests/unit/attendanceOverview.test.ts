import { describe, expect, it } from "vitest";
import { buildOverview, type OverviewClass, type OverviewCredit } from "@/modules/attendance/overview";

const klass = (over: Partial<OverviewClass> = {}): OverviewClass => ({
  id: "c1",
  volume: "Essência",
  schedule: "sabado",
  label: "Essência, sábado",
  reportRequired: true,
  meetings: [
    { id: "m1", sequence: 1, date: "2026-10-03", minutes: 240, past: true, lessonCount: 4, hasTeacher: true, hasReport: true },
    { id: "m2", sequence: 2, date: "2026-10-10", minutes: 240, past: true, lessonCount: 4, hasTeacher: true, hasReport: true },
    { id: "m3", sequence: 3, date: "2026-10-17", minutes: 240, past: false, lessonCount: 4, hasTeacher: true, hasReport: false },
  ],
  roster: Array.from({ length: 10 }, (_, i) => ({ key: `r:${i}`, name: `Aluno ${i}`, phone: null, stage: "matriculado" })),
  ...over,
});

const credit = (person: number, meeting: string, lessons: number[], over: Partial<OverviewCredit> = {}): OverviewCredit => ({
  person_key: `r:${person}`,
  meeting_id: meeting,
  counts_for_meeting_id: meeting,
  lessons,
  minutes: lessons.length * 60,
  source: "qr",
  location_status: "dentro",
  ...over,
});

const everyone = (meeting: string, count = 10) =>
  Array.from({ length: count }, (_, i) => credit(i, meeting, [1, 2, 3, 4]));

describe("buildOverview", () => {
  it("frequência média, faixas e último encontro", () => {
    const overview = buildOverview([klass()], [...everyone("m1"), ...everyone("m2", 5)]);
    // 5 alunos vieram aos dois encontros (100%); 5 faltaram ao 2º (50% dos realizados = 4 h de 8 h).
    expect(overview.avgPct).toBe(75);
    expect(overview.classes[0]?.meetings.find((m) => m.sequence === 2)?.pct).toBe(50);
    expect(overview.lastMeeting?.pct).toBe(50);
    expect(overview.lastMeeting?.versusAvg).toBe(-25);
    expect(overview.bands.total).toBe(10);
    expect(overview.histogram.map((h) => h.count)).toEqual([5, 0, 5, 0]);
  });

  it("origens das presenças", () => {
    const overview = buildOverview([klass()], [
      credit(0, "m1", [1, 2]),
      credit(1, "m1", [1, 2], { source: "manual" }),
      credit(2, "m1", [1, 2], { source: "autodeclaracao" }),
    ]);
    expect(overview.sources).toEqual({ qr: 1, manual: 1, reposicao: 0, autodeclaracao: 1 });
  });

  it("presença por aula dentro do encontro", () => {
    const credits = [
      ...Array.from({ length: 10 }, (_, i) => credit(i, "m1", [1, 2])),
      ...Array.from({ length: 4 }, (_, i) => credit(i, "m1", [3, 4], { source: "qr" })),
    ];
    const meeting = buildOverview([klass()], credits).classes[0]?.meetings[0];
    expect(meeting?.lessonPct).toEqual([100, 100, 40, 40]);
  });
});

describe("detectAnomalies", () => {
  it("encontro realizado sem nenhum registro de QR é falha técnica", () => {
    const overview = buildOverview([klass()], [...everyone("m1"), ...everyone("m2", 4).map((c) => ({ ...c, source: "manual" }))]);
    const texts = overview.anomalies.map((a) => a.text).join("\n");
    expect(texts).toMatch(/encontro 2: nenhum registro de QR/);
    expect(overview.anomalies[0]?.severity).toBe("alta");
  });

  it("presença muito abaixo da média da turma é sinalizada", () => {
    const overview = buildOverview([klass()], [...everyone("m1"), ...everyone("m2", 2)]);
    expect(overview.anomalies.some((a) => /menos da metade da média|queda de/.test(a.text))).toBe(true);
  });

  it("saída grande no intervalo", () => {
    const credits = Array.from({ length: 10 }, (_, i) => credit(i, "m1", i < 2 ? [1, 2, 3, 4] : [1, 2]));
    const overview = buildOverview([klass({ meetings: [klass().meetings[0]!] })], credits);
    expect(overview.anomalies.some((a) => /antes do intervalo/.test(a.text))).toBe(true);
  });

  it("muitos registros sem localização", () => {
    const credits = Array.from({ length: 10 }, (_, i) => credit(i, "m1", [1, 2, 3, 4], { location_status: i < 5 ? "sem_localizacao" : "dentro" }));
    const overview = buildOverview([klass({ meetings: [klass().meetings[0]!] })], credits);
    expect(overview.anomalies.some((a) => /sem localização ou longe/.test(a.text))).toBe(true);
  });

  it("encontro sem professor ou sem relatório", () => {
    const k = klass();
    k.meetings[0] = { ...k.meetings[0]!, hasTeacher: false };
    k.meetings[1] = { ...k.meetings[1]!, hasReport: false };
    const overview = buildOverview([k], [...everyone("m1"), ...everyone("m2")]);
    const texts = overview.anomalies.map((a) => a.text).join("\n");
    expect(texts).toMatch(/sem professor atribuído/);
    expect(texts).toMatch(/sem relatório pós-aula/);
  });

  it("temporada sem exigência de relatório: nunca alerta 'sem relatório pós-aula'", () => {
    const k = klass({ reportRequired: false });
    k.meetings[1] = { ...k.meetings[1]!, hasReport: false };
    const overview = buildOverview([k], [...everyone("m1"), ...everyone("m2")]);
    expect(overview.anomalies.map((a) => a.text).join("\n")).not.toMatch(/relatório/);
  });

  it("encontro bem abaixo do padrão das outras turmas (comparação entre turmas)", () => {
    const a = klass({ id: "ca", label: "A", meetings: [klass().meetings[0]!], roster: klass().roster.map((p) => ({ ...p, key: `a:${p.key}` })) });
    const b = klass({ id: "cb", label: "B", meetings: [{ ...klass().meetings[0]!, id: "mb" }], roster: klass().roster.map((p) => ({ ...p, key: `b:${p.key}` })) });
    const c = klass({ id: "cc", label: "C", meetings: [{ ...klass().meetings[0]!, id: "mc" }], roster: klass().roster.map((p) => ({ ...p, key: `c:${p.key}` })) });
    const mk = (prefix: string, meeting: string, count: number): OverviewCredit[] =>
      Array.from({ length: count }, (_, i) => ({ ...credit(i, meeting, [1, 2, 3, 4]), person_key: `${prefix}:r:${i}` }));
    // A: 9/10 (90%), B: 8/10 (80%), C: 4/10 (40%) — C fica abaixo de 75% da mediana (80%).
    const overview = buildOverview([a, b, c], [...mk("a", "m1", 9), ...mk("b", "mb", 8), ...mk("c", "mc", 4)]);
    expect(overview.anomalies.some((x) => x.classLabel === "C" && /padrão das demais turmas/.test(x.text))).toBe(true);
    expect(overview.anomalies.some((x) => x.classLabel === "A")).toBe(false);
  });

  it("presença absoluta muito baixa é sinalizada mesmo com um único encontro", () => {
    const overview = buildOverview([klass({ meetings: [klass().meetings[0]!] })], everyone("m1", 3));
    expect(overview.anomalies.some((x) => /apenas 30%/.test(x.text))).toBe(true);
  });

  it("turma saudável não gera alerta", () => {
    const overview = buildOverview([klass()], [...everyone("m1"), ...everyone("m2")]);
    expect(overview.anomalies).toEqual([]);
  });
});
