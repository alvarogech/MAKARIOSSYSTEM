import { describe, expect, it } from "vitest";
import { evaluateStudent } from "@/modules/graduation/eligibility";
import type {
  AssessmentFact,
  AttendanceFact,
  AttemptFact,
  EnrollmentFact,
  ModuleSlug,
  StudentFacts,
} from "@/modules/graduation/types";

const ctx = { now: new Date("2026-11-03T12:00:00-03:00"), minAttendanceRatio: 0.75 };

const attendance = (over: Partial<AttendanceFact> = {}): AttendanceFact => ({
  totalMinutes: 960,
  attendedMinutes: 960,
  missedMinutes: 0,
  absences: 0,
  situation: "em_dia",
  allMeetingsPast: true,
  lastMeetingDate: "2026-10-31",
  ...over,
});

const attempt = (over: Partial<AttemptFact> = {}): AttemptFact => ({
  status: "submitted",
  score: 8,
  submittedAt: "2026-10-31T15:00:00Z",
  deadlineAt: null,
  ...over,
});

const assessment = (over: Partial<AssessmentFact> = {}): AssessmentFact => ({
  assessmentId: "a1",
  type: "final",
  status: "open",
  passingGrade: 6,
  closesAt: "2026-11-13T02:59:59Z",
  eligible: true,
  attempts: [],
  extraAttemptGranted: false,
  ...over,
});

const enrollment = (volume: ModuleSlug, over: Partial<EnrollmentFact> = {}): EnrollmentFact => ({
  enrollmentId: `e-${volume}`,
  volume,
  seasonId: "s-2026-2",
  seasonName: "2026.2",
  seasonStartsOn: "2026-10-01",
  className: `${volume} — Turma (sábado)`,
  status: "active",
  finalGrade: null,
  updatedAt: "2026-10-31T00:00:00Z",
  attendance: attendance(),
  finalAssessment: assessment({ attempts: [attempt()] }),
  recoveryAssessment: null,
  ...over,
});

const approved = (volume: ModuleSlug, seasonName: string, startsOn: string): EnrollmentFact =>
  enrollment(volume, { status: "approved", seasonName, seasonStartsOn: startsOn, seasonId: `s-${seasonName}`, updatedAt: `${startsOn}T00:00:00Z` });

const facts = (over: Partial<StudentFacts> = {}): StudentFacts => ({
  studentId: "stu-1",
  requestId: "req-1",
  fullName: "Maria da Silva Souza",
  email: "maria@example.com",
  phone: "62999990000",
  enrollments: [],
  history: [],
  prerequisiteNote: null,
  pendingJustifications: 0,
  suspectedDuplicates: [],
  ...over,
});

const keysOpen = (e: ReturnType<typeof evaluateStudent>) =>
  e.requirements.filter((r) => r.blocking && r.state !== "cumprido").map((r) => r.key);

describe("evaluateStudent — aptidão", () => {
  it("cenário 1: três módulos concluídos, frequência e nota suficientes → APTO", () => {
    const e = evaluateStudent(
      facts({
        enrollments: [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01"), enrollment("voz")],
      }),
      ctx,
    );
    expect(e.overall).toBe("apto");
    expect(e.modules.map((m) => m.status)).toEqual(["concluido", "concluido", "concluido"]);
    expect(e.openCount).toBe(0);
    expect(e.nearlyDone).toBe(false);
  });

  it("cenário 2: Essência e Caminho de temporadas anteriores, Voz na atual → APTO, com temporada e origem", () => {
    const e = evaluateStudent(
      facts({ enrollments: [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01"), enrollment("voz")] }),
      ctx,
    );
    expect(e.overall).toBe("apto");
    const [essencia, caminho, voz] = e.modules as [typeof e.modules[number], typeof e.modules[number], typeof e.modules[number]];
    expect(essencia).toMatchObject({ seasonName: "2025.1", origin: "matricula_concluida" });
    expect(caminho).toMatchObject({ seasonName: "2026.1", origin: "matricula_concluida" });
    expect(voz).toMatchObject({ seasonName: "2026.2", origin: "plataforma", grade: 8 });
    expect(voz.completedOn).toBe("2026-10-31");
  });

  it("histórico validado por administrador comprova a conclusão", () => {
    const e = evaluateStudent(
      facts({
        enrollments: [enrollment("voz")],
        history: [
          { id: "h1", volume: "essencia", seasonLabel: "2025.1", origin: "Lista de presença impressa", evidence: "Pasta 2025", validatedAt: "2026-11-01T00:00:00Z", validatedByName: "Álvaro" },
          { id: "h2", volume: "caminho", seasonLabel: null, origin: "Livro de atas", evidence: "p. 12", validatedAt: "2026-11-01T00:00:00Z", validatedByName: "Álvaro" },
        ],
      }),
      ctx,
    );
    expect(e.overall).toBe("apto");
    expect(e.modules[0]!.origin).toBe("historico_validado");
  });

  it("nota exatamente igual ao mínimo é suficiente", () => {
    const e = evaluateStudent(
      facts({
        enrollments: [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01"), enrollment("voz", { finalAssessment: assessment({ attempts: [attempt({ score: 6 })] }) })],
      }),
      ctx,
    );
    expect(e.overall).toBe("apto");
  });

  it("matrícula cancelada ou trancada não comprova nada", () => {
    const e = evaluateStudent(
      facts({ enrollments: [enrollment("essencia", { status: "canceled" }), enrollment("caminho", { status: "withdrawn" }), enrollment("voz")] }),
      ctx,
    );
    expect(e.overall).toBe("em_conferencia");
    expect(e.modules[0]!.status).toBe("em_conferencia");
  });
});

describe("evaluateStudent — avaliação", () => {
  const previous = [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01")];

  it("cenário 3: não fez a avaliação final de Voz (janela aberta) → PENDENTE, a um passo de concluir", () => {
    const e = evaluateStudent(
      facts({ enrollments: [...previous, enrollment("voz", { finalAssessment: assessment({ attempts: [] }) })] }),
      ctx,
    );
    expect(e.overall).toBe("pendente");
    expect(keysOpen(e)).toEqual(["voz:avaliacao"]);
    expect(e.nearlyDone).toBe(true);
    expect(e.categories).toEqual(["avaliacao"]);
  });

  it("janela encerrada sem tentativa continua pendente (depende de tentativa excepcional)", () => {
    const e = evaluateStudent(
      facts({ enrollments: [...previous, enrollment("voz", { finalAssessment: assessment({ status: "closed", attempts: [] }) })] }),
      ctx,
    );
    expect(e.overall).toBe("pendente");
    expect(e.requirements.find((r) => r.key === "voz:avaliacao")?.guidance).toMatch(/excepcional/);
  });

  it("cenário 5: tentativa em andamento → EM ANDAMENTO; prazo vencido sem encerrar → EM CONFERÊNCIA", () => {
    const running = attempt({ status: "in_progress", score: null, submittedAt: null, deadlineAt: "2026-11-03T18:00:00-03:00" });
    const andamento = evaluateStudent(
      facts({ enrollments: [...previous, enrollment("voz", { finalAssessment: assessment({ attempts: [running] }) })] }),
      ctx,
    );
    expect(andamento.overall).toBe("em_andamento");

    const late = attempt({ status: "in_progress", score: null, submittedAt: null, deadlineAt: "2026-11-03T08:00:00-03:00" });
    const conferencia = evaluateStudent(
      facts({ enrollments: [...previous, enrollment("voz", { finalAssessment: assessment({ attempts: [late] }) })] }),
      ctx,
    );
    expect(conferencia.overall).toBe("em_conferencia");
  });

  it("nota abaixo do mínimo com recuperação disponível → PENDENTE; recuperação já feita e reprovada → NÃO APTO", () => {
    const below = assessment({ attempts: [attempt({ score: 4 })] });
    const comRecuperacao = evaluateStudent(
      facts({ enrollments: [...previous, enrollment("voz", { finalAssessment: below, recoveryAssessment: assessment({ type: "recovery", status: "draft" }) })] }),
      ctx,
    );
    expect(comRecuperacao.overall).toBe("pendente");

    const recuperacaoReprovada = evaluateStudent(
      facts({
        enrollments: [
          ...previous,
          enrollment("voz", { finalAssessment: below, recoveryAssessment: assessment({ type: "recovery", status: "closed", attempts: [attempt({ score: 5 })] }) }),
        ],
      }),
      ctx,
    );
    expect(recuperacaoReprovada.overall).toBe("nao_apto");
  });

  it("a nota da recuperação substitui a anterior quando é maior (regularização recalcula o resultado)", () => {
    const antes = facts({
      enrollments: [...previous, enrollment("voz", { finalAssessment: assessment({ attempts: [attempt({ score: 4 })] }), recoveryAssessment: assessment({ type: "recovery", status: "open" }) })],
    });
    expect(evaluateStudent(antes, ctx).overall).toBe("pendente");

    // cenário 7: o aluno faz a recuperação e passa → a mesma função devolve APTO
    const depois = facts({
      enrollments: [
        ...previous,
        enrollment("voz", {
          finalAssessment: assessment({ attempts: [attempt({ score: 4 })] }),
          recoveryAssessment: assessment({ type: "recovery", status: "open", attempts: [attempt({ score: 7.5, submittedAt: "2026-11-05T10:00:00Z" })] }),
        }),
      ],
    });
    const e = evaluateStudent(depois, ctx);
    expect(e.overall).toBe("apto");
    expect(e.modules[2]!.grade).toBe(7.5);
    expect(e.modules[2]!.completedOn).toBe("2026-11-05");
  });
});

describe("evaluateStudent — frequência", () => {
  const previous = [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01")];
  const low = attendance({ attendedMinutes: 600, missedMinutes: 360, absences: 2, situation: "reprovado" });

  it("cenário 4: frequência insuficiente → PENDENTE com orientação de regularização", () => {
    const e = evaluateStudent(facts({ enrollments: [...previous, enrollment("voz", { attendance: low })] }), ctx);
    expect(e.overall).toBe("pendente");
    const req = e.requirements.find((r) => r.key === "voz:frequencia")!;
    expect(req.state).toBe("pendente");
    expect(req.reason).toMatch(/abaixo do mínimo/);
    expect(req.guidance).toMatch(/reposição/);
  });

  it("justificativas aguardando análise → EM CONFERÊNCIA (resultado ainda não é definitivo)", () => {
    const e = evaluateStudent(facts({ enrollments: [...previous, enrollment("voz", { attendance: low })], pendingJustifications: 2 }), ctx);
    expect(e.overall).toBe("em_conferencia");
    expect(e.requirements.find((r) => r.key === "voz:frequencia")?.reason).toMatch(/2 pedido/);
  });

  it("matrícula não aprovada por frequência → NÃO APTO", () => {
    const e = evaluateStudent(facts({ enrollments: [...previous, enrollment("voz", { attendance: low, status: "failed" })] }), ctx);
    expect(e.overall).toBe("nao_apto");
  });

  it("encontros ainda por acontecer, sem faltas excedentes → EM ANDAMENTO", () => {
    const running = attendance({ allMeetingsPast: false, attendedMinutes: 480, missedMinutes: 0, situation: "em_dia" });
    const e = evaluateStudent(facts({ enrollments: [...previous, enrollment("voz", { attendance: running, finalAssessment: assessment({ status: "draft" }) })] }), ctx);
    expect(e.overall).toBe("em_andamento");
  });
});

describe("evaluateStudent — histórico e integridade", () => {
  it("cenário 6: matriculado em Voz sem registro confiável de Caminho → EM CONFERÊNCIA, sem presumir aprovação", () => {
    const e = evaluateStudent(facts({ enrollments: [approved("essencia", "2025.1", "2025-03-01"), enrollment("voz")] }), ctx);
    expect(e.overall).toBe("em_conferencia");
    expect(e.modules[1]).toMatchObject({ slug: "caminho", status: "em_conferencia", origin: "sem_evidencia" });
    expect(e.nearlyDone).toBe(false);
  });

  it("a declaração escrita na inscrição aparece como pista, mas não comprova", () => {
    const e = evaluateStudent(
      facts({ enrollments: [enrollment("voz")], prerequisiteNote: "Já fiz o volume 1 e 2 na Emaús" }),
      ctx,
    );
    expect(e.overall).toBe("em_conferencia");
    const req = e.requirements.find((r) => r.key === "essencia:conclusao")!;
    expect(req.reason).toMatch(/Já fiz o volume 1 e 2/);
    expect(req.reason).toMatch(/não comprova/);
    expect(req.category).toBe("historico");
  });

  it("cenário 8: várias pendências aparecem todas, sem esconder nenhuma", () => {
    const e = evaluateStudent(
      facts({
        enrollments: [
          approved("essencia", "2025.1", "2025-03-01"),
          enrollment("voz", {
            attendance: attendance({ attendedMinutes: 600, missedMinutes: 360, absences: 2, situation: "reprovado" }),
            finalAssessment: assessment({ attempts: [] }),
          }),
        ],
        prerequisiteNote: "Cursei o Caminho",
      }),
      ctx,
    );
    expect(e.overall).toBe("pendente");
    expect(keysOpen(e).sort()).toEqual(["caminho:conclusao", "voz:avaliacao", "voz:frequencia"]);
    expect(e.openCount).toBe(3);
    expect(e.nearlyDone).toBe(false);
    expect(e.categories.sort()).toEqual(["avaliacao", "frequencia", "historico"]);
  });

  it("cenário 9: possível duplicata nunca é mesclada; vira conferência mesmo com os módulos concluídos", () => {
    const e = evaluateStudent(
      facts({
        enrollments: [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01"), enrollment("voz")],
        suspectedDuplicates: [{ profileId: "other", name: "Maria da Silva", reason: "nome parecido" }],
      }),
      ctx,
    );
    expect(e.overall).toBe("em_conferencia");
    expect(e.requirements.find((r) => r.key === "cadastro:duplicado")?.guidance).toMatch(/Nunca mesclar/);
    expect(e.modules.every((m) => m.status === "concluido")).toBe(true);
  });

  it("nome de uma palavra e telefone ausente são avisos: não bloqueiam", () => {
    const e = evaluateStudent(
      facts({
        fullName: "Maria",
        phone: null,
        enrollments: [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01"), enrollment("voz")],
      }),
      ctx,
    );
    expect(e.overall).toBe("apto");
    expect(e.requirements.filter((r) => r.state === "aviso").map((r) => r.key).sort()).toEqual(["cadastro:nome", "cadastro:telefone"]);
  });

  it("matrícula em regularização gera aviso, não bloqueio", () => {
    const e = evaluateStudent(
      facts({ enrollments: [approved("essencia", "2025.1", "2025-03-01"), approved("caminho", "2026.1", "2026-03-01"), enrollment("voz", { status: "regularization" })] }),
      ctx,
    );
    expect(e.overall).toBe("apto");
    expect(e.requirements.some((r) => r.key === "voz:matricula" && r.state === "aviso")).toBe(true);
  });

  it("matrícula concluída tem precedência sobre dados antigos de frequência", () => {
    const e = evaluateStudent(
      facts({
        enrollments: [
          enrollment("essencia", { status: "approved", attendance: attendance({ situation: "reprovado", attendedMinutes: 0, missedMinutes: 960 }) }),
          approved("caminho", "2026.1", "2026-03-01"),
          enrollment("voz"),
        ],
      }),
      ctx,
    );
    expect(e.modules[0]!.status).toBe("concluido");
  });
});
