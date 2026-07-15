import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { SupabaseJobsQueue } from "./adapters/supabaseJobsQueue";
import type { AsyncTaskQueue } from "./asyncTaskQueue";

export type {
  AsyncTaskQueue,
  ClaimOptions,
  EnqueueOptions,
  Job,
  JobPayload,
  JobStatus,
  JobType,
} from "./asyncTaskQueue";

/**
 * Ponto único de obtenção da fila de tarefas assíncronas. Troque a
 * implementação aqui (ex.: para um adapter BullMQ/Redis, se um dia for
 * necessário) sem tocar em nenhum call site de `enqueue(...)`.
 */
export function getAsyncTaskQueue(): AsyncTaskQueue {
  return new SupabaseJobsQueue(createSupabaseAdminClient());
}
