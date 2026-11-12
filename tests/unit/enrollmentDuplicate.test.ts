import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { id: string; email: string; cpf_hash: string; status: string; season_id: string }
let rows: Row[] = [];
let inserted: unknown[] = [];
/** Falhas de mentira e contagem de leituras, para os casos de borda. */
let insertError: { code: string } | null = null;
let queryFails = false;
let reads = 0;

/** Banco de mentira: aplica só os filtros que a regra usa. */
function fakeAdmin() {
  return {
    from(table: string) {
      if (table === "seasons") {
        const chain: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
        chain.maybeSingle = async () => ({ data: { id: "S1" } });
        return chain;
      }
      const filters: ((r: Row) => boolean)[] = [];
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: keyof Row, v: string) => (filters.push((r) => r[c] === v), chain),
        neq: (c: keyof Row, v: string) => (filters.push((r) => r[c] !== v), chain),
        in: (c: keyof Row, v: string[]) => (filters.push((r) => v.includes(r[c])), chain),
        ilike: (c: keyof Row, p: string) => {
          const needle = p.replace(/^%|%$/g, "").replace(/\\(.)/g, "$1").toLowerCase();
          filters.push((r) => r[c].toLowerCase().includes(needle));
          return chain;
        },
        limit: () => chain,
        insert: async (row: unknown) => (insertError ? { error: insertError } : (inserted.push(row), { error: null })),
        then: (resolve: (v: unknown) => void) => {
          reads += 1;
          return resolve(
            queryFails
              ? { data: null, error: { message: "tempo esgotado" } }
              : { data: rows.filter((r) => filters.every((f) => f(r))), error: null },
          );
        },
      };
      return chain;
    },
  };
}

vi.mock("@/integrations/supabase/admin", () => ({ createSupabaseAdminClient: () => fakeAdmin() }));
vi.mock("@/modules/enrollment/dataProtection", () => ({
  protectCpf: (cpf: string) => ({ encrypted: "x", hash: `h-${cpf}`, last4: cpf.slice(-4) }),
}));

import { DUPLICATE_CPF_MESSAGE, findEnrollmentConflict, isEmailChange } from "@/modules/enrollment/duplicateCheck";
import { submitEnrollmentRequest } from "@/modules/enrollment/actions/submitEnrollmentRequest";

const base = (over: Partial<Row> = {}): Row => ({
  id: "R1", email: "ana@teste.local", cpf_hash: "h-52998224725", status: "pending", season_id: "S1", ...over,
});

function form(over: Record<string, string> = {}) {
  const f = new FormData();
  const data: Record<string, string> = {
    fullName: "Pessoa de Teste", cpf: "529.982.247-25", email: "novo@teste.local", phone: "62999999999",
    primaryVolume: "essencia", primarySchedule: "terca_quinta", isOtherChurchMember: "false",
    isEmausMember: "false", privacyConsent: "on", ...over,
  };
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

beforeEach(() => { rows = []; inserted = []; insertError = null; queryFails = false; reads = 0; });

describe("findEnrollmentConflict", () => {
  it("acha CPF repetido", async () => {
    rows = [base()];
    expect(await findEnrollmentConflict(fakeAdmin() as never, { seasonId: "S1", email: "x@y.com", cpfHash: "h-52998224725" })).toBe("cpf");
  });
  it("acha e-mail repetido sem diferenciar maiúsculas nem espaços", async () => {
    rows = [base({ email: " Ana@Teste.local " })];
    expect(await findEnrollmentConflict(fakeAdmin() as never, { seasonId: "S1", email: "ANA@teste.local" })).toBe("email");
  });
  it("e-mail parecido mas diferente não conta", async () => {
    rows = [base({ email: "banana@teste.local" })];
    expect(await findEnrollmentConflict(fakeAdmin() as never, { seasonId: "S1", email: "ana@teste.local" })).toBeNull();
  });
  it("inscrição recusada, cancelada ou de outro semestre não conta", async () => {
    rows = [base({ status: "rejected" }), base({ id: "R2", status: "cancelled" }), base({ id: "R3", season_id: "S0" })];
    expect(await findEnrollmentConflict(fakeAdmin() as never, { seasonId: "S1", email: "ana@teste.local", cpfHash: "h-52998224725" })).toBeNull();
  });
  it("na edição a própria inscrição é ignorada, mas outra com o mesmo e-mail barra", async () => {
    rows = [base()];
    expect(await findEnrollmentConflict(fakeAdmin() as never, { seasonId: "S1", email: "ana@teste.local", excludeId: "R1" })).toBeNull();
    rows = [base(), base({ id: "R2", cpf_hash: "outro" })];
    expect(await findEnrollmentConflict(fakeAdmin() as never, { seasonId: "S1", email: "ana@teste.local", excludeId: "R1" })).toBe("email");
  });
});

describe("submitEnrollmentRequest com repetição", () => {
  it("barra CPF repetido, marca o campo cpf e não grava", async () => {
    rows = [base()];
    const r = await submitEnrollmentRequest({}, form());
    expect(r.success).toBeUndefined();
    expect(r.error).toContain("CPF");
    expect(r.fieldErrors?.cpf).toBeDefined();
    expect(inserted).toHaveLength(0);
  });
  it("barra e-mail repetido, marca o campo email e não grava", async () => {
    rows = [base({ cpf_hash: "outro" })];
    const r = await submitEnrollmentRequest({}, form({ email: "ANA@teste.local" }));
    expect(r.error).toContain("cada um com o seu");
    expect(r.fieldErrors?.email).toBeDefined();
    expect(inserted).toHaveLength(0);
  });
  it("aceita quando nada se repete", async () => {
    rows = [base({ cpf_hash: "outro", email: "outra@teste.local" })];
    const r = await submitEnrollmentRequest({}, form());
    expect(r.success).toBe(true);
    expect(inserted).toHaveLength(1);
  });
});

describe("submitEnrollmentRequest nos casos de borda", () => {
  it("honeypot preenchido responde sucesso sem consultar nem gravar, mesmo com CPF repetido", async () => {
    rows = [base()];
    const r = await submitEnrollmentRequest({}, form({ website: "https://robo.teste" }));
    expect(r.success).toBe(true);
    expect(reads).toBe(0);
    expect(inserted).toHaveLength(0);
  });
  it("corrida de dois envios do mesmo CPF: o índice único do banco vira a frase de CPF no campo cpf", async () => {
    insertError = { code: "23505" };
    const r = await submitEnrollmentRequest({}, form());
    expect(r.success).toBeUndefined();
    expect(r.error).toBe(DUPLICATE_CPF_MESSAGE);
    expect(r.fieldErrors?.cpf).toEqual([DUPLICATE_CPF_MESSAGE]);
  });
  it("banco falhando na conferência não deixa passar: pede para tentar de novo e não grava", async () => {
    queryFails = true;
    const r = await submitEnrollmentRequest({}, form());
    expect(r.success).toBeUndefined();
    expect(r.error).toContain("Tente novamente");
    expect(inserted).toHaveLength(0);
  });
});

describe("isEmailChange (edição pela coordenação)", () => {
  it("mesmo e-mail com maiúscula ou espaço diferente não é troca: inscrição antiga repetida segue editável", () => {
    expect(isEmailChange("ana@teste.local", " Ana@Teste.local ")).toBe(false);
  });
  it("e-mail diferente é troca e passa pela conferência", () => {
    expect(isEmailChange("ana2@teste.local", "ana@teste.local")).toBe(true);
  });
});
