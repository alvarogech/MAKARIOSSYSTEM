import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let db: Record<string, Row[]> = {};
let inserted: Row[] = [];
let updated: Row[] = [];
let silentFail = false;
const authState = { allowed: true, userId: "coord-1" };

function table(name: string) {
  const filters: [string, unknown][] = [];
  let mode: "select" | "insert" | "update" = "select";
  let payload: Row = {};
  const match = () => (db[name] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (k: string, v: unknown) => (filters.push([k, v]), chain),
    insert: (row: Row) => ((mode = "insert"), (payload = row), chain),
    update: (row: Row) => ((mode = "update"), (payload = row), chain),
    maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => {
      if (mode === "insert") {
        if (silentFail) return resolve({ data: [], error: null });
        inserted.push(payload);
        return resolve({ data: [{ id: "new" }], error: null });
      }
      if (mode === "update") {
        if (silentFail) return resolve({ data: [], error: null });
        updated.push(payload);
        return resolve({ data: [{ id: "x" }], error: null });
      }
      return resolve({ data: match(), error: null });
    },
  };
  return chain;
}

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/integrations/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from: table }) }));
vi.mock("@/authorization", () => ({
  can: () => authState.allowed,
  getAuthContext: async () => ({ userId: authState.userId }),
}));
vi.mock("@/modules/academic/lookupUser", () => ({
  findUserIdByEmailAndRole: async (_c: unknown, email: string) =>
    email === "aluno@teste.local" ? { userId: "stu-1", fullName: "Aluna de Teste" } : null,
}));

import { grantLateRelease } from "@/modules/assessment/actions/grantLateRelease";

const PAST = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

function form(over: Record<string, string> = {}) {
  const f = new FormData();
  const base: Record<string, string> = {
    assessmentId: "11111111-1111-4111-8111-111111111111",
    studentEmail: "aluno@teste.local",
    reason: "Aluna procurou a coordenação",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

beforeEach(() => {
  inserted = [];
  updated = [];
  silentFail = false;
  authState.allowed = true;
  db = {
    assessments: [{ id: "11111111-1111-4111-8111-111111111111", status: "open", closes_at: PAST, season_volume_offering_id: "off-1" }],
    enrollments: [{ id: "enr-1", student_id: "stu-1", season_volume_offering_id: "off-1", status: "active" }],
    assessment_late_releases: [],
  };
});

describe("grantLateRelease", () => {
  it("sem permissão não grava nada", async () => {
    authState.allowed = false;
    const r = await grantLateRelease({}, form());
    expect(r.error).toMatch(/permissão/);
    expect(inserted).toHaveLength(0);
  });

  it("exige motivo de pelo menos 10 letras", async () => {
    const r = await grantLateRelease({}, form({ reason: "curto" }));
    expect(r.error).toMatch(/motivo/i);
    expect(inserted).toHaveLength(0);
  });

  it("cria a liberação por 24 horas, em nome de quem liberou, também para quem nunca abriu a prova", async () => {
    const before = Date.now();
    const r = await grantLateRelease({}, form());
    expect(r.success).toMatch(/Prova liberada para Aluna de Teste até \d{2}\/\d{2} às \d{2}:\d{2}\./);
    expect(inserted).toHaveLength(1);
    const row = inserted[0]!;
    expect(row).toMatchObject({ assessment_id: "11111111-1111-4111-8111-111111111111", enrollment_id: "enr-1", granted_by: "coord-1" });
    const hours = (new Date(row.valid_until as string).getTime() - before) / 3600000;
    expect(hours).toBeGreaterThan(23.99);
    expect(hours).toBeLessThan(24.01);
  });

  it("renova a liberação que já existe, em vez de duplicar", async () => {
    db.assessment_late_releases = [{ id: "rel-1", assessment_id: "11111111-1111-4111-8111-111111111111", enrollment_id: "enr-1" }];
    const r = await grantLateRelease({}, form());
    expect(r.success).toMatch(/Liberação renovada/);
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ granted_by: "coord-1" });
  });

  it("recusa quando o prazo ainda não encerrou (o aluno já pode fazer)", async () => {
    db.assessments = [{ ...db.assessments![0]!, closes_at: FUTURE }];
    const r = await grantLateRelease({}, form());
    expect(r.error).toMatch(/ainda não encerrou/);
    expect(inserted).toHaveLength(0);
  });

  it("recusa avaliação que não está aberta, aluno desconhecido, sem matrícula e matrícula inativa", async () => {
    db.assessments = [{ ...db.assessments![0]!, status: "draft" }];
    expect((await grantLateRelease({}, form())).error).toMatch(/não está aberta/);

    db.assessments = [{ ...db.assessments![0]!, status: "open" }];
    expect((await grantLateRelease({}, form({ studentEmail: "ninguem@teste.local" }))).error).toMatch(/Nenhum aluno/);

    db.enrollments = [];
    expect((await grantLateRelease({}, form())).error).toMatch(/não está matriculado/);

    db.enrollments = [{ id: "enr-1", student_id: "stu-1", season_volume_offering_id: "off-1", status: "canceled" }];
    expect((await grantLateRelease({}, form())).error).toMatch(/não está ativa/);
    expect(inserted).toHaveLength(0);
  });

  it("se o banco recusar em silêncio (RLS), não diz que liberou", async () => {
    silentFail = true;
    const r = await grantLateRelease({}, form());
    expect(r.success).toBeUndefined();
    expect(r.error).toMatch(/Não foi possível liberar/);
  });
});
