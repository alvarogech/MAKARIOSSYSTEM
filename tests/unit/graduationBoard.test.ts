import { describe, expect, it } from "vitest";
import {
  applyFilters,
  claimsRegularizedButNot,
  EMPTY_FILTERS,
  inTab,
  isOverdue,
  isRegularized,
  parseFilters,
  sortForRegularization,
  summarize,
  type BoardRow,
  type ContactStatus,
  type FollowUpView,
} from "@/modules/graduation/boardView";
import type { Evaluation, OverallStatus, PendencyCategory } from "@/modules/graduation/types";

const evaluation = (overall: OverallStatus, categories: PendencyCategory[] = [], over: Partial<Evaluation> = {}): Evaluation => ({
  studentId: "x",
  overall,
  modules: [],
  requirements: [],
  openCount: categories.length,
  pendingCount: categories.length,
  categories,
  nearlyDone: overall === "pendente" && categories.length === 1,
  ...over,
});

const followUp = (contactStatus: ContactStatus, dueDate: string | null = null): FollowUpView => ({
  requirementKey: "geral",
  contactStatus,
  responsibleId: "u1",
  responsibleName: "Gabi",
  nextStep: null,
  dueDate,
  notes: null,
  updatedAt: "2026-11-01T00:00:00Z",
});

const row = (name: string, ev: Evaluation, over: Partial<BoardRow> = {}): BoardRow => ({
  studentId: name,
  requestId: null,
  name,
  email: `${name.toLowerCase().replace(/\s/g, "")}@example.com`,
  phone: "62999990000",
  className: "Voz — Turma (sábado)",
  seasonName: "2026.2",
  evaluation: ev,
  vozAttendancePct: null,
  vozGrade: null,
  participant: {
    id: "p",
    invitedAt: null,
    invitedStatus: null,
    response: "sem_resposta",
    respondedAt: null,
    responseSource: null,
    responseChannel: null,
    ceremonyAttendance: "nao_registrado",
    certificateName: null,
    certificateNameCheckedAt: null,
    addedReason: "candidato_voz",
  },
  followUp: null,
  requirementFollowUps: [],
  lastContactAt: null,
  ...over,
});

describe("parseFilters", () => {
  it("descarta valores que não existem em vez de confiar na URL", () => {
    const f = parseFilters({ status: "hackeado", pendencia: "x", contato: "y", quantidade: "9", q: "  ana  ", aba: undefined });
    expect(f).toEqual({ ...EMPTY_FILTERS, q: "ana" });
  });

  it("aceita valores válidos e combina filtros", () => {
    const f = parseFilters({ status: "pendente", pendencia: "avaliacao", quantidade: "1", contato: "nao_contatado", turma: ["Voz"] });
    expect(f).toMatchObject({ status: "pendente", pendencia: "avaliacao", quantidade: "1", contato: "nao_contatado", turma: "Voz" });
  });
});

describe("applyFilters", () => {
  const rows = [
    row("José da Conceição", evaluation("pendente", ["avaliacao"])),
    row("Maria Souza", evaluation("pendente", ["avaliacao", "frequencia", "historico"]), { followUp: followUp("aguardando_aluno") }),
    row("Pedro Lima", evaluation("apto"), { phone: "62988887777", className: "Voz — Turma (terça/quinta)" }),
  ];
  const names = (f: Partial<typeof EMPTY_FILTERS>) => applyFilters(rows, { ...EMPTY_FILTERS, ...f }).map((r) => r.name);

  it("busca por nome sem depender de acento ou caixa, por e-mail e por telefone", () => {
    expect(names({ q: "jose conceicao".split(" ")[0] })).toEqual(["José da Conceição"]);
    expect(names({ q: "MARIA" })).toEqual(["Maria Souza"]);
    expect(names({ q: "pedrolima@" })).toEqual(["Pedro Lima"]);
    expect(names({ q: "(62) 98888-7777" })).toEqual(["Pedro Lima"]);
  });

  it("filtros combinados: status, pendência, quantidade, contato, turma", () => {
    expect(names({ status: "pendente" })).toEqual(["José da Conceição", "Maria Souza"]);
    expect(names({ pendencia: "frequencia" })).toEqual(["Maria Souza"]);
    expect(names({ quantidade: "1" })).toEqual(["José da Conceição"]);
    expect(names({ quantidade: "3+" })).toEqual(["Maria Souza"]);
    expect(names({ contato: "aguardando_aluno" })).toEqual(["Maria Souza"]);
    expect(names({ contato: "nao_contatado", status: "pendente" })).toEqual(["José da Conceição"]);
    expect(names({ turma: "Voz — Turma (terça/quinta)" })).toEqual(["Pedro Lima"]);
    expect(names({ responsavel: "sem" })).toEqual(["José da Conceição", "Pedro Lima"]);
    expect(names({ responsavel: "u1" })).toEqual(["Maria Souza"]);
  });
});

describe("central de regularização", () => {
  const today = "2026-11-03";

  it("ordem de trabalho: a uma pendência de apto, prazo próximo, sem contato, demais", () => {
    const sorted = sortForRegularization(
      [
        row("D demais", evaluation("pendente", ["avaliacao", "frequencia"]), { followUp: followUp("aguardando_aluno") }),
        row("C sem contato", evaluation("pendente", ["avaliacao", "frequencia"])),
        row("B prazo", evaluation("pendente", ["avaliacao", "frequencia"]), { followUp: followUp("aguardando_aluno", "2026-11-05") }),
        row("A quase", evaluation("pendente", ["avaliacao"])),
      ],
      today,
    );
    expect(sorted.map((r) => r.name)).toEqual(["A quase", "B prazo", "C sem contato", "D demais"]);
  });

  it("abas: avaliação, frequência, histórico e aguardando", () => {
    const aval = row("a", evaluation("pendente", ["avaliacao"]));
    const hist = row("h", evaluation("em_conferencia", ["conclusao_caminho"]));
    const wait = row("w", evaluation("pendente", ["frequencia", "avaliacao"]), { followUp: followUp("aguardando_atualizacao_academica") });
    const ok = row("ok", evaluation("apto"));
    expect([aval, hist, wait, ok].filter((r) => inTab(r, "todos")).map((r) => r.name)).toEqual(["a", "h", "w"]);
    expect([aval, hist, wait].filter((r) => inTab(r, "avaliacao")).map((r) => r.name)).toEqual(["a", "w"]);
    expect([aval, hist, wait].filter((r) => inTab(r, "historico")).map((r) => r.name)).toEqual(["h"]);
    expect([aval, hist, wait].filter((r) => inTab(r, "aguardando_coordenacao")).map((r) => r.name)).toEqual(["w"]);
  });

  it("regularizado só vale quando os DADOS mostram apto; declaração não basta", () => {
    const comprovado = row("c", evaluation("apto"), { followUp: followUp("regularizacao_concluida") });
    const soDeclarado = row("d", evaluation("pendente", ["avaliacao"]), { followUp: followUp("regularizacao_concluida") });
    const nuncaAcompanhado = row("n", evaluation("apto"));
    expect(isRegularized(comprovado)).toBe(true);
    expect(isRegularized(soDeclarado)).toBe(false);
    expect(isRegularized(nuncaAcompanhado)).toBe(false);
    expect(claimsRegularizedButNot(soDeclarado)).toBe(true);
    expect(inTab(comprovado, "regularizados")).toBe(true);
  });

  it("prazo vencido só conta enquanto o acompanhamento está aberto", () => {
    expect(isOverdue(row("a", evaluation("pendente"), { followUp: followUp("aguardando_aluno", "2026-11-01") }), "2026-11-03")).toBe(true);
    expect(isOverdue(row("a", evaluation("pendente"), { followUp: followUp("encerrado_sem_regularizacao", "2026-11-01") }), "2026-11-03")).toBe(false);
  });
});

describe("summarize", () => {
  it("conta tudo a partir das linhas reais, sem números fixos", () => {
    const s = summarize([
      row("1", evaluation("apto")),
      row("2", evaluation("apto")),
      row("3", evaluation("pendente", ["avaliacao"])),
      row("4", evaluation("pendente", ["avaliacao", "frequencia"]), { followUp: followUp("aguardando_aluno") }),
      row("5", evaluation("em_conferencia", ["historico"])),
      row("6", evaluation("nao_apto", ["frequencia"])),
      row("7", evaluation("em_andamento")),
    ]);
    expect(s).toMatchObject({ candidates: 7, apto: 2, pendente: 2, em_conferencia: 1, nao_apto: 1, em_andamento: 1, nearlyDone: 1, toContact: 3 });
    expect(s.byCategory).toMatchObject({ avaliacao: 2, frequencia: 2, historico: 1, conclusao_voz: 0 });
    expect(summarize([])).toMatchObject({ candidates: 0, apto: 0 });
  });
});
