import { describe, expect, it, vi } from "vitest";
import { SupabaseJobsQueue } from "@/jobs/adapters/supabaseJobsQueue";

/**
 * Testa apenas a FORMA das chamadas RPC feitas pelo adapter (nomes de
 * função, nomes de parâmetro) — não o comportamento do banco em si, que
 * pertence aos testes de integração (tests/integration/), fora do escopo
 * de execução desta sessão. Garante que o contrato entre o adapter e as
 * funções SQL de supabase/migrations/..._jobs.sql não diverge em silêncio.
 */
function makeFakeSupabaseClient(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockReturnValue({
    single: () => Promise.resolve(rpcResult),
    maybeSingle: () => Promise.resolve(rpcResult),
    then: (resolve: (value: typeof rpcResult) => void) =>
      resolve(rpcResult),
  });

  return { rpc } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const SAMPLE_JOB_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "send_email",
  payload: { to: "aluno.teste@makarios.local" },
  status: "pending" as const,
  attempts: 0,
  max_attempts: 5,
  available_at: "2026-01-01T00:00:00.000Z",
  locked_at: null,
  locked_by: null,
  started_at: null,
  completed_at: null,
  failed_at: null,
  last_error: null,
  idempotency_key: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("SupabaseJobsQueue (adapter de AsyncTaskQueue)", () => {
  it("enqueue chama a RPC enqueue_job com os parâmetros esperados", async () => {
    const client = makeFakeSupabaseClient({ data: SAMPLE_JOB_ROW, error: null });
    const queue = new SupabaseJobsQueue(client);

    const job = await queue.enqueue(
      "send_email",
      { to: "aluno.teste@makarios.local" },
      { idempotencyKey: "convite-123" },
    );

    expect(client.rpc).toHaveBeenCalledWith(
      "enqueue_job",
      expect.objectContaining({
        p_type: "send_email",
        p_payload: { to: "aluno.teste@makarios.local" },
        p_idempotency_key: "convite-123",
      }),
    );
    expect(job.id).toBe(SAMPLE_JOB_ROW.id);
    expect(job.status).toBe("pending");
  });

  it("claim chama a RPC claim_job com o worker e tipos informados", async () => {
    const client = makeFakeSupabaseClient({
      data: { ...SAMPLE_JOB_ROW, status: "processing" },
      error: null,
    });
    const queue = new SupabaseJobsQueue(client);

    const job = await queue.claim({
      worker: "netlify-scheduled-fn",
      types: ["send_email"],
    });

    expect(client.rpc).toHaveBeenCalledWith("claim_job", {
      p_worker: "netlify-scheduled-fn",
      p_types: ["send_email"],
    });
    expect(job?.status).toBe("processing");
  });

  it("claim retorna null quando não há tarefa disponível", async () => {
    const client = makeFakeSupabaseClient({ data: null, error: null });
    const queue = new SupabaseJobsQueue(client);

    const job = await queue.claim({ worker: "netlify-scheduled-fn" });

    expect(job).toBeNull();
  });

  it("markCompleted chama complete_job com o id da tarefa", async () => {
    const client = makeFakeSupabaseClient({ data: null, error: null });
    const queue = new SupabaseJobsQueue(client);

    await queue.markCompleted(SAMPLE_JOB_ROW.id);

    expect(client.rpc).toHaveBeenCalledWith("complete_job", {
      p_job_id: SAMPLE_JOB_ROW.id,
    });
  });

  it("markFailed chama fail_job com o erro e a flag de retry", async () => {
    const client = makeFakeSupabaseClient({ data: null, error: null });
    const queue = new SupabaseJobsQueue(client);

    await queue.markFailed(SAMPLE_JOB_ROW.id, "SMTP timeout", { retry: false });

    expect(client.rpc).toHaveBeenCalledWith("fail_job", {
      p_job_id: SAMPLE_JOB_ROW.id,
      p_error: "SMTP timeout",
      p_retry: false,
    });
  });
});
