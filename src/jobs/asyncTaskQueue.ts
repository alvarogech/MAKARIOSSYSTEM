/**
 * Contrato único de "processamento em background" para toda a aplicação.
 *
 * Nenhuma regra de negócio deve conhecer o mecanismo por trás desta
 * interface. A implementação inicial (`SupabaseJobsQueue`, em
 * `./adapters/supabaseJobsQueue.ts`) usa a tabela `private.jobs` do
 * Postgres, processada por Supabase Cron/Netlify Scheduled+Background
 * Functions — sem Redis/BullMQ. Se o volume um dia justificar uma fila de
 * verdade, basta escrever um novo adapter (`BullMqTaskQueue`, por
 * exemplo) que implemente esta mesma interface; nenhum call site de
 * `enqueue(...)` precisa mudar.
 *
 * Nesta fase (Fundação), apenas a estrutura e os contratos existem — os
 * handlers concretos por tipo de tarefa (e-mail, PDF, importação,
 * verificação de avaliação vencida) serão adicionados nas fases seguintes.
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Tipos de tarefa conhecidos pelo sistema. Deliberadamente vazio no fechamento
 * de tipo além do índice de string — cada fase futura estende esta união
 * (ex.: "send_email" | "generate_certificate_pdf" | "process_import_row" |
 * "expire_assessment_attempts") no módulo que introduzir o handler
 * correspondente, mantendo o contrato central agnóstico de domínio.
 */
export type JobType = string;

export interface JobPayload {
  [key: string]: unknown;
}

export interface EnqueueOptions {
  /** Quando a tarefa deve ficar disponível para captura. Padrão: agora. */
  availableAt?: Date;
  /** Máximo de tentativas antes de marcar como `failed` definitivamente. */
  maxAttempts?: number;
  /**
   * Chave opcional que torna o enqueue idempotente: chamar `enqueue` duas
   * vezes com a mesma `idempotencyKey` nunca cria duas tarefas.
   */
  idempotencyKey?: string;
}

export interface Job<TPayload extends JobPayload = JobPayload> {
  id: string;
  type: JobType;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimOptions {
  /**
   * Identificador do worker que está reivindicando a tarefa (ex.: nome da
   * Netlify Function + timestamp), gravado em `locked_by` para depuração.
   */
  worker: string;
  /** Restringe a captura a um subconjunto de tipos de tarefa, se informado. */
  types?: JobType[];
}

/**
 * Toda implementação de `AsyncTaskQueue` deve garantir que `claim` seja
 * transacional e livre de processamento duplicado quando chamada por dois
 * workers concorrentes (o adapter inicial usa `FOR UPDATE SKIP LOCKED` no
 * Postgres para isso — ver supabase/migrations/..._jobs.sql).
 *
 * Toda tarefa enfileirada deve ser idempotente: o handler que a processa
 * precisa poder rodar mais de uma vez com o mesmo efeito líquido, já que
 * falhas parciais (processou, mas não confirmou `complete`) resultam em
 * nova tentativa.
 */
export interface AsyncTaskQueue {
  enqueue<TPayload extends JobPayload = JobPayload>(
    type: JobType,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<Job<TPayload>>;

  /** Reivindica a próxima tarefa pendente disponível, ou `null` se não houver nenhuma. */
  claim(options: ClaimOptions): Promise<Job | null>;

  markCompleted(jobId: string): Promise<void>;

  markFailed(
    jobId: string,
    error: string,
    options?: { retry?: boolean },
  ): Promise<void>;
}
