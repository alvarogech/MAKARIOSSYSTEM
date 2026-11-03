import { describe, expect, it } from "vitest";
import { can } from "@/authorization";
import type { AuthContext, RoleSlug } from "@/authorization/types";
import { formatDay, fromLocalInput, toLocalInput } from "@/modules/graduation/dates";

const as = (role: RoleSlug, over: Partial<AuthContext> = {}): AuthContext => ({
  userId: "u1",
  fullName: "Fulano",
  profileStatus: "active",
  roles: [role],
  activeRole: role,
  ...over,
});

const ACTIONS = ["view", "contact", "validate_history", "configure", "record_rsvp", "export"] as const;

describe("permissões da Central de Formatura (cenário 13)", () => {
  it("aluno, professor e editor de conteúdo não têm nenhuma permissão de formatura", () => {
    for (const role of ["student", "teacher", "content_editor"] as const) {
      for (const action of ACTIONS) expect(can(as(role), { resource: "graduation", action })).toBe(false);
    }
  });

  it("coordenação vê, contata, configura, registra respostas e exporta — mas não valida histórico", () => {
    const coordinator = as("coordinator");
    for (const action of ["view", "contact", "configure", "record_rsvp", "export"] as const) {
      expect(can(coordinator, { resource: "graduation", action })).toBe(true);
    }
    expect(can(coordinator, { resource: "graduation", action: "validate_history" })).toBe(false);
  });

  it("administrador tem todas, inclusive validar histórico", () => {
    for (const action of ACTIONS) expect(can(as("admin"), { resource: "graduation", action })).toBe(true);
  });

  it("conta suspensa perde tudo, e perfil que a conta não possui não vale", () => {
    expect(can(as("admin", { profileStatus: "suspended" }), { resource: "graduation", action: "view" })).toBe(false);
    expect(can(as("admin", { roles: ["student"] }), { resource: "graduation", action: "view" })).toBe(false);
  });
});

describe("datas da cerimônia", () => {
  it("converte o prazo do formulário (horário de Brasília) e volta sem mudar o valor", () => {
    const iso = fromLocalInput("2026-12-01T23:59");
    expect(iso).toBe("2026-12-01T23:59:00-03:00");
    expect(toLocalInput(new Date(iso!).toISOString())).toBe("2026-12-01T23:59");
  });

  it("rejeita valores fora do formato e tolera vazio", () => {
    expect(fromLocalInput("01/12/2026 23:59")).toBeNull();
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });

  it("escreve a data por extenso em português", () => {
    expect(formatDay("2026-12-12")).toMatch(/sábado, 12 de dezembro de 2026/i);
    expect(formatDay(null)).toBe("—");
  });
});
