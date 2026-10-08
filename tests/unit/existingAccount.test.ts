import { describe, expect, it } from "vitest";
import { findExistingAccountForPerson, isSamePerson, normalizePersonName } from "@/modules/enrollment/existingAccount";

describe("normalizePersonName / isSamePerson", () => {
  it("ignora acento, caixa e espaços repetidos", () => {
    expect(normalizePersonName("  Natália   Cristye  Braga Santos ")).toBe("natalia cristye braga santos");
    expect(isSamePerson("Natália Cristye Braga Santos", "natalia cristye braga santos")).toBe(true);
  });

  it("pessoas diferentes que dividem e-mail (família) não são a mesma pessoa", () => {
    expect(isSamePerson("Fernando Itamar Duarte de Paula", "Ninive Damas de Morais Duarte")).toBe(false);
  });

  it("nome vazio nunca casa", () => {
    expect(isSamePerson("", "")).toBe(false);
  });
});

/** Cliente de mentira: cada tabela devolve as linhas combinadas. */
function fakeAdmin(tables: { enrollment_requests?: unknown; profiles?: Record<string, unknown>[] }) {
  const builder = (rows: unknown) => {
    const api: Record<string, unknown> = {};
    const chain = () => api;
    api.select = chain;
    api.eq = chain;
    api.ilike = chain;
    api.maybeSingle = async () => ({ data: Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null) });
    api.then = (resolve: (value: { data: unknown }) => unknown) => resolve({ data: rows });
    return api;
  };
  return {
    from: (table: string) => builder(table === "enrollment_requests" ? tables.enrollment_requests : tables.profiles ?? []),
  } as never;
}

describe("findExistingAccountForPerson", () => {
  it("inscrição já ligada a uma conta existente: não cria outra", async () => {
    const admin = fakeAdmin({ enrollment_requests: { student_id: "p1", full_name: "Ana" }, profiles: [{ id: "p1", full_name: "Ana" }] });
    const found = await findExistingAccountForPerson(admin, { enrollmentRequestId: "r1", contactEmail: "ana@x.com", names: ["Ana"] });
    expect(found?.reason).toBe("request_linked");
  });

  it("mesmo e-mail e mesmo nome (com outra grafia): é a mesma pessoa", async () => {
    const admin = fakeAdmin({ enrollment_requests: { student_id: null, full_name: "Natália Braga" }, profiles: [{ id: "p2", full_name: "NATALIA BRAGA" }] });
    const found = await findExistingAccountForPerson(admin, { enrollmentRequestId: "r1", contactEmail: "n@x.com", names: ["Natália Braga"] });
    expect(found).toEqual({ reason: "same_person", profileId: "p2" });
  });

  it("mesmo e-mail e nome diferente (familiar): permitido", async () => {
    const admin = fakeAdmin({ enrollment_requests: { student_id: null, full_name: "Ninive Duarte" }, profiles: [{ id: "p3", full_name: "Fernando Duarte" }] });
    const found = await findExistingAccountForPerson(admin, { enrollmentRequestId: "r1", contactEmail: "f@x.com", names: ["Ninive Duarte"] });
    expect(found).toBeNull();
  });
});
