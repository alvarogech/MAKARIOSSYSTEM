import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AsyncTaskQueue,
  ClaimOptions,
  EnqueueOptions,
  Job,
  JobPayload,
  JobStatus,
  JobType,
} from "../asyncTaskQueue";

/**
 * Implementação inicial de `AsyncTaskQueue` sobre a tabela `private.jobs`.
 *
 * A tabela vive no schema `private` (nunca roteável via PostgREST). As
 * funções de manejo (`enqueue_job`, `claim_job`, `complete_job`,
 * `fail_job`) vivem em `public` — único jeito de chamá-las via
 * `supabase.rpc(...)` — mas têm EXECUTE restrito a `service_role` via
 * GRANT/REVOKE na migration (ver supabase/migrations/..._jobs.sql). Por
 * isso este adapter só funciona com o client administrativo, e é
 * exclusivamente server-side (import "server-only" no topo).
 */

interface JobRow {
  id: string;
  type: string;
  payload: JobPayload;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  available_at: string;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

function toJob<TPayload extends JobPayload>(row: JobRow): Job<TPayload> {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload as TPayload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: new Date(row.available_at),
    lockedAt: row.locked_at ? new Date(row.locked_at) : null,
    lockedBy: row.locked_by,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    failedAt: row.failed_at ? new Date(row.failed_at) : null,
    lastError: row.last_error,
    idempotencyKey: row.idempotency_key,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SupabaseJobsQueue implements AsyncTaskQueue {
  constructor(private readonly adminClient: SupabaseClient) {}

  async enqueue<TPayload extends JobPayload = JobPayload>(
    type: JobType,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<Job<TPayload>> {
    const { data, error } = await this.adminClient
      .rpc("enqueue_job", {
        p_type: type,
        p_payload: payload,
        p_available_at: (options?.availableAt ?? new Date()).toISOString(),
        p_max_attempts: options?.maxAttempts ?? 5,
        p_idempotency_key: options?.idempotencyKey ?? null,
      })
      .single();

    if (error || !data) {
      throw new Error(
        `Falha ao enfileirar tarefa "${type}": ${error?.message ?? "resultado vazio"}`,
      );
    }

    return toJob<TPayload>(data as JobRow);
  }

  async claim(options: ClaimOptions): Promise<Job | null> {
    const { data, error } = await this.adminClient
      .rpc("claim_job", {
        p_worker: options.worker,
        p_types: options.types ?? null,
      })
      .maybeSingle();

    if (error) {
      throw new Error(`Falha ao reivindicar tarefa: ${error.message}`);
    }

    return data ? toJob(data as JobRow) : null;
  }

  async markCompleted(jobId: string): Promise<void> {
    const { error } = await this.adminClient.rpc("complete_job", {
      p_job_id: jobId,
    });

    if (error) {
      throw new Error(`Falha ao concluir tarefa ${jobId}: ${error.message}`);
    }
  }

  async markFailed(
    jobId: string,
    error: string,
    options?: { retry?: boolean },
  ): Promise<void> {
    const { error: rpcError } = await this.adminClient.rpc("fail_job", {
      p_job_id: jobId,
      p_error: error,
      p_retry: options?.retry ?? true,
    });

    if (rpcError) {
      throw new Error(
        `Falha ao registrar falha da tarefa ${jobId}: ${rpcError.message}`,
      );
    }
  }
}
