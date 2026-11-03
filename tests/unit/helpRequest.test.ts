import { describe, expect, it } from "vitest";
import { parseHelpRequest, parseStudentAdjustment } from "@/modules/support/helpRequest";

// CPF válido de exemplo (dígitos verificadores corretos), não é de ninguém.
const base = { fullName: "Maria da Silva", cpf: "529.982.247-25", phone: "(62) 99999-0000", problems: ["login"], message: "" };

describe("parseHelpRequest", () => {
  it("aceita um pedido completo e normaliza CPF, WhatsApp e mensagem vazia", () => {
    const r = parseHelpRequest(base);
    expect(r).toEqual({
      ok: true,
      data: { fullName: "Maria da Silva", cpf: "52998224725", phone: "62999990000", problems: ["login"], message: null },
    });
  });

  it("recusa CPF inválido", () => {
    const r = parseHelpRequest({ ...base, cpf: "111.111.111-11" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.cpf).toBeDefined();
  });

  it("recusa WhatsApp sem DDD", () => {
    const r = parseHelpRequest({ ...base, phone: "99999-0000" });
    expect(r.ok === false && r.errors.phone).toBeTruthy();
  });

  it("exige um problema marcado ou uma mensagem", () => {
    expect(parseHelpRequest({ ...base, problems: [] }).ok).toBe(false);
    expect(parseHelpRequest({ ...base, problems: [], message: "Não consigo ver minhas aulas" }).ok).toBe(true);
  });

  it("“Outro problema” exige a explicação", () => {
    const r = parseHelpRequest({ ...base, problems: ["outro"] });
    expect(r.ok === false && r.errors.message).toBeTruthy();
    expect(parseHelpRequest({ ...base, problems: ["outro"], message: "Meu certificado" }).ok).toBe(true);
  });

  it("recusa opção que não existe e tira repetidas", () => {
    expect(parseHelpRequest({ ...base, problems: ["hackear"] }).ok).toBe(false);
    const r = parseHelpRequest({ ...base, problems: ["login", "login", "convite"] });
    expect(r.ok && r.data.problems).toEqual(["login", "convite"]);
  });
});

describe("parseStudentAdjustment", () => {
  const adj = { problems: ["turma_errada"], wantedVolume: "caminho", wantedSchedule: "sabado", message: "" };

  it("aceita troca de volume/turma com o destino e mensagem vazia", () => {
    const r = parseStudentAdjustment(adj);
    expect(r).toEqual({ ok: true, data: { problems: ["turma_errada"], wantedVolume: "caminho", wantedSchedule: "sabado", message: null } });
  });

  it("troca de turma exige volume e horário de destino", () => {
    const r = parseStudentAdjustment({ ...adj, wantedVolume: "", wantedSchedule: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["wantedSchedule", "wantedVolume"]);
  });

  it("recusa volume ou horário que não existem", () => {
    expect(parseStudentAdjustment({ ...adj, wantedVolume: "inexistente" }).ok).toBe(false);
    expect(parseStudentAdjustment({ ...adj, wantedSchedule: "domingo" }).ok).toBe(false);
  });

  it("dados errados e outro exigem explicação; destino é descartado quando não é troca", () => {
    expect(parseStudentAdjustment({ ...adj, problems: ["dados_errados"] }).ok).toBe(false);
    const r = parseStudentAdjustment({ ...adj, problems: ["dados_errados"], message: "Meu nome está com erro" });
    expect(r.ok && r.data.wantedVolume).toBeNull();
  });

  it("exige marcar alguma coisa e recusa opções fora da lista do aluno", () => {
    expect(parseStudentAdjustment({ ...adj, problems: [] }).ok).toBe(false);
    expect(parseStudentAdjustment({ ...adj, problems: ["login"] }).ok).toBe(false);
  });
});
