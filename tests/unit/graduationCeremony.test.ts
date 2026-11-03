import { describe, expect, it } from "vitest";
import { buildContactLink, buildContactMessage, firstName } from "@/modules/graduation/contactMessage";
import {
  ceremonyStats,
  inviteConflicts,
  materialChanges,
  missingPublishFields,
  rsvpWindow,
  type CeremonyFields,
} from "@/modules/graduation/ceremony";
import type { OverallStatus, Requirement } from "@/modules/graduation/types";

const req = (over: Partial<Requirement>): Requirement => ({
  key: "voz:avaliacao",
  module: "voz",
  category: "avaliacao",
  title: "Avaliação final de Voz",
  state: "pendente",
  blocking: true,
  reason: "",
  guidance: "",
  action: null,
  ...over,
});

describe("buildContactMessage", () => {
  it("pendência de avaliação: texto do módulo, sem afirmar aprovação", () => {
    const text = buildContactMessage("MARIA da silva", [req({})]);
    expect(text).toContain("Olá, Maria! Tudo bem?");
    expect(text).toContain("pendência na sua avaliação do módulo Voz");
    expect(text).toContain("Se tiver alguma dificuldade, nos avise");
    expect(text).not.toMatch(/aprovad|garantid|apto|vaga/i);
  });

  it("pendência de frequência", () => {
    const text = buildContactMessage("João", [req({ key: "voz:frequencia", category: "frequencia" })]);
    expect(text).toContain("pendência relacionada à sua frequência");
    expect(text).toContain("verificar se todas as suas presenças estão corretas");
  });

  it("histórico: pede data, turma e comprovante, e não presume conclusão", () => {
    const text = buildContactMessage("Ana", [req({ key: "caminho:conclusao", module: "caminho", category: "historico", state: "em_conferencia" })]);
    expect(text).toContain("não encontramos no sistema a conclusão do módulo Caminho");
    expect(text).toContain("comprovante");
  });

  it("cenário 8: várias pendências viram uma lista, sem esconder nenhuma e sem repetir", () => {
    const text = buildContactMessage("Pedro", [
      req({}),
      req({ key: "voz:frequencia", category: "frequencia" }),
      req({ key: "caminho:conclusao", module: "caminho", category: "conclusao_caminho", state: "em_conferencia" }),
      req({ key: "essencia:conclusao", module: "essencia", category: "conclusao_essencia", state: "em_conferencia" }),
    ]);
    expect(text).toContain("• a avaliação final do módulo Voz");
    expect(text).toContain("• a frequência do módulo Voz");
    expect(text).toContain("• o registro de conclusão do módulo Caminho");
    expect(text).toContain("• o registro de conclusão do módulo Essência");
  });

  it("ignora requisitos que não são pendência (cumpridos, em andamento, avisos)", () => {
    const text = buildContactMessage("Lia", [req({ state: "cumprido" }), req({ key: "x", state: "em_andamento" }), req({ key: "y", state: "aviso", blocking: false })]);
    expect(text).toContain("queremos conferir seus dados com você");
  });

  it("o link carrega a mensagem codificada e usa o telefone normalizado", () => {
    const link = buildContactLink("(62) 99999-0000", "Olá, Ana!\nTudo bem?");
    expect(link).toBe("https://wa.me/5562999990000?text=Ol%C3%A1%2C%20Ana!%0ATudo%20bem%3F");
  });

  it("firstName tolera espaços e caixa", () => {
    expect(firstName("  jOÃO paulo ")).toBe("João");
    expect(firstName("")).toBe("");
  });
});

describe("cerimônia", () => {
  const full: CeremonyFields = {
    eventName: "Formatura Makários 2026-2",
    eventDate: "2026-12-12",
    eventTime: "19:00",
    locationName: "Igreja Emaús",
    address: "Av. T-1, 1470",
    rsvpDeadline: "2026-12-01T23:59:00-03:00",
  };

  it("sem data nem local, a publicação lista o que falta (nunca inventa)", () => {
    expect(missingPublishFields({ ...full, eventDate: null, locationName: " ", rsvpDeadline: null })).toEqual([
      "data",
      "local",
      "prazo para confirmação",
    ]);
    expect(missingPublishFields(full)).toEqual([]);
  });

  it("janela de confirmação: só depois de publicada, aberta e dentro do prazo", () => {
    const now = new Date("2026-11-20T12:00:00-03:00");
    const open = { status: "confirmacoes_abertas" as const, publishedAt: "2026-11-10T00:00:00Z", rsvpDeadline: full.rsvpDeadline };
    expect(rsvpWindow(open, now)).toBe("aberta");
    expect(rsvpWindow({ ...open, publishedAt: null }, now)).toBe("nao_publicada");
    expect(rsvpWindow({ ...open, status: "regularizacao" }, now)).toBe("nao_publicada");
    expect(rsvpWindow({ ...open, status: "confirmacoes_encerradas" }, now)).toBe("encerrada");
    expect(rsvpWindow(open, new Date("2026-12-02T00:00:00-03:00"))).toBe("prazo_encerrado");
  });

  it("cenário 12: mudar data, horário, local ou endereço é detectado; mudar o prazo não exige aviso", () => {
    expect(materialChanges(full, { ...full, eventDate: "2026-12-19", locationName: "Outro local" })).toEqual(["data", "local"]);
    expect(materialChanges(full, { ...full, rsvpDeadline: "2026-12-05T23:59:00-03:00" })).toEqual([]);
  });

  it("cenário 15: convidado que deixou de ser apto vira conflito; quem segue apto, não", () => {
    const status = new Map<string, OverallStatus>([
      ["a", "apto"],
      ["b", "pendente"],
      ["c", "em_conferencia"],
      ["d", "pendente"],
    ]);
    const conflicts = inviteConflicts(
      [
        { studentId: "a", invitedAt: "2026-11-10", invitedStatus: "apto", response: "confirmado" },
        { studentId: "b", invitedAt: "2026-11-10", invitedStatus: "apto", response: "confirmado" },
        { studentId: "c", invitedAt: "2026-11-10", invitedStatus: "apto", response: "sem_resposta" },
        { studentId: "d", invitedAt: null, invitedStatus: null, response: "sem_resposta" },
      ],
      status,
    );
    expect(conflicts.map((c) => c.studentId)).toEqual(["b", "c"]);
    expect(conflicts[0]).toMatchObject({ currentStatus: "pendente", response: "confirmado" });
  });

  it("cenários 10 e 11: confirmar ou recusar só mexe nos números da cerimônia", () => {
    const stats = ceremonyStats([
      { invitedAt: "x", response: "confirmado", responseSource: "aluno", incomplete: false },
      { invitedAt: "x", response: "confirmado", responseSource: "coordenacao", incomplete: true },
      { invitedAt: "x", response: "nao_comparece", responseSource: "aluno", incomplete: false },
      { invitedAt: "x", response: "sem_resposta", responseSource: null, incomplete: false },
      { invitedAt: null, response: "sem_resposta", responseSource: null, incomplete: false },
    ]);
    expect(stats).toEqual({ invited: 4, confirmed: 2, declined: 1, awaiting: 1, recordedByCoordination: 1, confirmedIncomplete: 1 });
  });
});
