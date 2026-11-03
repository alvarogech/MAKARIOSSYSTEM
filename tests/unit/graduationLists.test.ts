import { describe, expect, it } from "vitest";
import type { BoardRow } from "@/modules/graduation/boardView";
import { buildListTable, certificateNameOf, nameIssues, selectList, standardizeName } from "@/modules/graduation/lists";
import type { Evaluation, OverallStatus } from "@/modules/graduation/types";

const evaluation = (overall: OverallStatus): Evaluation => ({
  studentId: "x",
  overall,
  modules: [
    { slug: "essencia", label: "Essência", status: "concluido", origin: "matricula_concluida", seasonName: "2025.1", className: null, completedOn: "2025-06-30", attendance: null, grade: null, passingGrade: null, note: "" },
    { slug: "caminho", label: "Caminho", status: "concluido", origin: "matricula_concluida", seasonName: "2026.1", className: null, completedOn: null, attendance: null, grade: null, passingGrade: null, note: "" },
    { slug: "voz", label: "Voz", status: overall === "apto" ? "concluido" : "pendente", origin: "plataforma", seasonName: "2026.2", className: "Voz — Turma (sábado)", completedOn: "2026-10-31", attendance: null, grade: 8, passingGrade: 6, note: "" },
  ],
  requirements: [],
  openCount: overall === "apto" ? 0 : 1,
  pendingCount: 0,
  categories: [],
  nearlyDone: false,
});

const row = (
  name: string,
  overall: OverallStatus,
  p: Partial<BoardRow["participant"]> = {},
): BoardRow => ({
  studentId: `id-${name}`,
  requestId: null,
  name,
  email: null,
  phone: "62999990000",
  className: "Voz — Turma (sábado)",
  seasonName: "2026.2",
  evaluation: evaluation(overall),
  vozAttendancePct: 92.5,
  vozGrade: 8,
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
    ...p,
  },
  followUp: null,
  requirementFollowUps: [],
  lastContactAt: null,
});

const invited = { invitedAt: "2026-11-10T00:00:00Z", invitedStatus: "apto" };
const confirmed = { ...invited, response: "confirmado" as const, respondedAt: "2026-11-11T00:00:00Z", responseSource: "aluno" as const };
const declined = { ...invited, response: "nao_comparece" as const, respondedAt: "2026-11-11T00:00:00Z", responseSource: "aluno" as const };

describe("listas da formatura", () => {
  const rows = [
    row("Ana Confirmada", "apto", confirmed),
    row("Bia Recusou", "apto", declined),
    row("Caio Sem Resposta", "apto", invited),
    row("Davi Nao Convidado", "apto"),
    row("Eva Pendente Confirmada", "pendente", confirmed),
  ];
  const names = (code: Parameters<typeof selectList>[1]) => selectList(rows, code).map((r) => r.name);

  it("aptos, convidados, confirmados e sem resposta", () => {
    expect(names("aptos")).toEqual(["Ana Confirmada", "Bia Recusou", "Caio Sem Resposta", "Davi Nao Convidado"]);
    expect(names("convidados")).toEqual(["Ana Confirmada", "Bia Recusou", "Caio Sem Resposta", "Eva Pendente Confirmada"]);
    expect(names("confirmados")).toEqual(["Ana Confirmada", "Eva Pendente Confirmada"]);
    expect(names("sem_resposta")).toEqual(["Caio Sem Resposta"]);
    expect(names("nao_confirmados")).toEqual(["Bia Recusou", "Caio Sem Resposta"]);
  });

  it("cenário 11: quem recusou continua apto, mas fora da lista final; aparece em 'concluíram, mas não participarão'", () => {
    expect(names("final")).toEqual(["Ana Confirmada"]);
    expect(names("concluiram_sem_participar")).toEqual(["Bia Recusou"]);
    expect(names("aptos")).toContain("Bia Recusou");
  });

  it("a lista final só leva quem confirmou E segue apto (confirmação sozinha não basta)", () => {
    expect(names("final")).not.toContain("Eva Pendente Confirmada");
  });

  it("certificados: nunca inclui aluno que não está apto", () => {
    const table = buildListTable(rows, "certificados", "Formatura 2026-2");
    expect(table.rows.map((r) => r[0])).toEqual(["Ana Confirmada", "Bia Recusou", "Caio Sem Resposta", "Davi Nao Convidado"]);
    expect(table.rows.some((r) => r[0]?.includes("Eva"))).toBe(false);
    const ana = table.rows[0]!;
    expect(ana[4]).toBe("Essência, Caminho, Voz");
    expect(ana[5]).toContain("Essência: 30/06/2025");
    expect(ana[5]).toContain("Caminho: 2026.1");
    expect(ana[6]).toBe("Formatura 2026-2");
  });

  it("tabela geral: situação por módulo, frequência, nota e origem da resposta", () => {
    const table = buildListTable([row("Ana", "apto", { ...confirmed, responseSource: "coordenacao", responseChannel: "whatsapp" })], "confirmados", "X");
    const record = Object.fromEntries(table.headers.map((h, i) => [h, table.rows[0]![i]]));
    expect(record["Situação de Voz"]).toBe("Concluído");
    expect(record["Frequência em Voz"]).toBe("92,5%");
    expect(record["Nota em Voz"]).toBe("8,0");
    expect(record["Origem da resposta"]).toBe("Registrado pela coordenação (whatsapp)");
    expect(record["Telefone"]).toBe("(62) 99999-0000");
  });
});

describe("nomes para o certificado", () => {
  it("padroniza a caixa sem trocar letras e respeita as partículas", () => {
    expect(standardizeName("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(standardizeName("joão  paulo de  souza-lima")).toBe("João Paulo de Souza-Lima");
  });

  it("aponta nomes incompletos ou inconsistentes antes da impressão", () => {
    expect(nameIssues("Maria")).toContain("nome sem sobrenome");
    expect(nameIssues("MARIA SILVA")).toContain("tudo em maiúsculas");
    expect(nameIssues("maria silva")).toContain("tudo em minúsculas");
    expect(nameIssues("Maria Silva2")).toContain("contém números");
    expect(nameIssues("Maria  Silva")).toContain("espaços sobrando");
    expect(nameIssues("Maria da Silva")).toEqual([]);
  });

  it("o nome conferido pela coordenação vale mais que o do cadastro", () => {
    const checked = row("MARIA SILVA", "apto", { certificateName: "Maria de Fátima Silva", certificateNameCheckedAt: "2026-11-12T00:00:00Z" });
    expect(certificateNameOf(checked)).toEqual({ name: "Maria de Fátima Silva", checked: true, issues: [] });
    const unchecked = certificateNameOf(row("MARIA SILVA", "apto"));
    expect(unchecked).toMatchObject({ name: "Maria Silva", checked: false });
    expect(unchecked.issues).toContain("tudo em maiúsculas");
  });
});
