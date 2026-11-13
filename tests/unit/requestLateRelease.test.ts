import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const authState = { student: true, userId: "stu-1" };
const rate = { ok: true };
const redirectTo: string[] = [];

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectTo.push(url);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/integrations/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));
vi.mock("@/authorization", () => ({
  can: () => true,
  canAccessArea: () => authState.student,
  getAuthContext: async () => ({ userId: authState.userId }),
}));
vi.mock("@/modules/auth/rateLimit", () => ({ checkRateLimit: async () => rate.ok }));

import { requestLateRelease } from "@/modules/assessment/actions/requestLateRelease";
import { setLateRequestsWindow } from "@/modules/assessment/actions/setLateRequestsWindow";

const ID = "11111111-1111-4111-8111-111111111111";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  authState.student = true;
  rate.ok = true;
  redirectTo.length = 0;
});

describe("requestLateRelease (o aluno pede a liberação)", () => {
  it("aluno sem tentativa pede: chama a função do banco com o motivo e cai na preparação da prova", async () => {
    await expect(requestLateRelease({}, form({ assessmentId: ID, reason: "  Fiquei sem internet o prazo todo.  " }))).rejects.toThrow("NEXT_REDIRECT");
    expect(rpc).toHaveBeenCalledWith("request_late_release", { p_assessment_id: ID, p_reason: "Fiquei sem internet o prazo todo." });
    expect(redirectTo).toEqual([`/avaliacoes/${ID}`]);
  });

  it("a identidade vem da sessão: nome, CPF ou e-mail digitados não vão ao banco", async () => {
    await expect(
      requestLateRelease({}, form({ assessmentId: ID, reason: "Motivo bem explicado aqui", studentEmail: "outra@pessoa.com", cpf: "123" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(Object.keys(rpc.mock.calls[0]![1] as object).sort()).toEqual(["p_assessment_id", "p_reason"]);
  });

  it("motivo curto ou longo demais é recusado antes de ir ao banco", async () => {
    expect((await requestLateRelease({}, form({ assessmentId: ID, reason: "curto" }))).error).toMatch(/pelo menos 10/);
    expect((await requestLateRelease({}, form({ assessmentId: ID, reason: "a".repeat(501) }))).error).toMatch(/no máximo 500/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("quem não é aluno é recusado", async () => {
    authState.student = false;
    const r = await requestLateRelease({}, form({ assessmentId: ID, reason: "Motivo bem explicado aqui" }));
    expect(r.error).toMatch(/aluno/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("muitos pedidos seguidos são barrados pelo limite", async () => {
    rate.ok = false;
    const r = await requestLateRelease({}, form({ assessmentId: ID, reason: "Motivo bem explicado aqui" }));
    expect(r.error).toMatch(/Muitos pedidos/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aluno com tentativa, fora da janela ou outra regra do banco: mostra a frase do banco", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Você já fez esta avaliação. Se precisar de ajuda, fale com a coordenação da Escola Makários." },
    });
    const r = await requestLateRelease({}, form({ assessmentId: ID, reason: "Motivo bem explicado aqui" }));
    expect(r.error).toBe("Você já fez esta avaliação. Se precisar de ajuda, fale com a coordenação da Escola Makários.");
    expect(redirectTo).toHaveLength(0);
  });

  it("falha técnica do banco não vaza para o aluno", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied for table x" } });
    const r = await requestLateRelease({}, form({ assessmentId: ID, reason: "Motivo bem explicado aqui" }));
    expect(r.error).toBe("Não foi possível liberar a prova agora. Tente de novo em instantes.");
    expect(r.error).not.toMatch(/permission/);
  });
});

describe("setLateRequestsWindow (coordenação)", () => {
  it("salva a data no horário de Brasília", async () => {
    const r = await setLateRequestsWindow({}, form({ assessmentId: ID, intent: "save", until: "2026-11-13T23:59" }));
    expect(rpc).toHaveBeenCalledWith("set_late_requests_window", { p_assessment_id: ID, p_until: "2026-11-14T02:59:00.000Z" });
    expect(r.success).toBe("Pedidos de liberação abertos até 13/11 às 23:59.");
  });

  it("desligar manda nulo", async () => {
    const r = await setLateRequestsWindow({}, form({ assessmentId: ID, intent: "off" }));
    expect(rpc).toHaveBeenCalledWith("set_late_requests_window", { p_assessment_id: ID, p_until: null });
    expect(r.success).toBe("Pedidos de liberação desligados.");
  });

  it("salvar sem escolher a data é recusado", async () => {
    const r = await setLateRequestsWindow({}, form({ assessmentId: ID, intent: "save", until: "" }));
    expect(r.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
