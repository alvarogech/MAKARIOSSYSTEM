import { describe, expect, it } from "vitest";
import { parseHelpRequest } from "@/modules/support/helpRequest";

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
