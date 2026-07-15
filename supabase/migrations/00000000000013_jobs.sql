-- Tabela `jobs`: implementação inicial da abstração AsyncTaskQueue
-- (ver src/jobs/asyncTaskQueue.ts e PLANO_TECNICO.md seção 5/6).
--
-- Estrutura e contratos apenas — nenhum processador de tarefa é criado
-- nesta fase (nem envio de e-mail, nem PDF, nem importação). O objetivo
-- aqui é só garantir que a captura de uma tarefa seja transacional e livre
-- de processamento duplicado (FOR UPDATE SKIP LOCKED), pronta para ganhar
-- handlers reais nas fases seguintes.
--
-- Nota de arquitetura sobre schema: a TABELA fica em `private` (nunca
-- roteável pela API automática do Supabase, já que apenas o schema
-- `public` é exposto ao PostgREST por padrão). As FUNÇÕES de manejo da
-- fila (enqueue/claim/complete/fail) precisam ficar em `public` para
-- serem chamáveis via `supabase.rpc(...)` — o acesso a elas é então
-- restrito via REVOKE/GRANT a apenas `service_role` (a mesma trava que
-- protege o client administrativo: só código server-side com a secret key
-- consegue chamá-las).

create type private.job_status as enum ('pending', 'processing', 'completed', 'failed');

create table private.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status private.job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_idempotency_key_unique unique (idempotency_key),
  constraint jobs_attempts_non_negative check (attempts >= 0),
  constraint jobs_max_attempts_positive check (max_attempts > 0)
);

comment on table private.jobs is
  'Fila de tarefas assíncronas (adapter inicial de AsyncTaskQueue). Nunca '
  'exposta pela API pública. Toda tarefa deve ser idempotente — '
  'idempotency_key permite ao chamador evitar duplicar o mesmo enqueue.';

create index jobs_claimable_idx
  on private.jobs (available_at)
  where status = 'pending';

create trigger jobs_set_updated_at
  before update on private.jobs
  for each row execute function public.set_updated_at();

alter table private.jobs enable row level security;
-- Nenhuma policy: mesmo que o schema `private` um dia seja exposto por
-- engano, ninguém além do dono da tabela (que as funções abaixo usam via
-- SECURITY DEFINER) consegue ler ou escrever aqui.

-- Captura transacional e sem duplicidade de uma tarefa pendente.
-- FOR UPDATE SKIP LOCKED garante que, se dois workers chamarem esta função
-- ao mesmo tempo (ex.: duas execuções sobrepostas de uma Netlify Scheduled
-- Function), cada um pega uma tarefa diferente — nunca a mesma.
create or replace function public.claim_job(p_worker text, p_types text[] default null)
returns private.jobs
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_job private.jobs;
begin
  select *
  into v_job
  from private.jobs
  where status = 'pending'
    and available_at <= now()
    and (p_types is null or type = any (p_types))
  order by available_at asc, created_at asc
  for update skip locked
  limit 1;

  if v_job.id is null then
    return null;
  end if;

  update private.jobs
  set status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker,
      started_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.claim_job(text, text[]) is
  'Reivindica a próxima tarefa pendente para o worker informado. '
  'Transacional e seguro contra corrida (FOR UPDATE SKIP LOCKED). '
  'EXECUTE restrito a service_role — ver GRANT/REVOKE ao final do arquivo.';

create or replace function public.complete_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = private, public
as $$
  update private.jobs
  set status = 'completed',
      completed_at = now(),
      locked_at = null,
      locked_by = null
  where id = p_job_id;
$$;

-- Se p_retry = true e ainda houver tentativas disponíveis, a tarefa volta
-- para `pending` com backoff exponencial simples (capado em 6 min); caso
-- contrário, é marcada como `failed` definitivamente.
create or replace function public.fail_job(p_job_id uuid, p_error text, p_retry boolean default true)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_job private.jobs;
begin
  select * into v_job from private.jobs where id = p_job_id;

  if v_job.id is null then
    return;
  end if;

  if p_retry and v_job.attempts < v_job.max_attempts then
    update private.jobs
    set status = 'pending',
        last_error = p_error,
        locked_at = null,
        locked_by = null,
        available_at = now() + (least(v_job.attempts, 6) * interval '1 minute')
    where id = p_job_id;
  else
    update private.jobs
    set status = 'failed',
        last_error = p_error,
        failed_at = now(),
        locked_at = null,
        locked_by = null
    where id = p_job_id;
  end if;
end;
$$;

-- Enfileira uma nova tarefa. `p_idempotency_key`, quando informado, evita
-- duplicar a mesma tarefa em enqueues repetidos (ex.: retry do lado do
-- chamador) — insert é um no-op silencioso nesse caso.
create or replace function public.enqueue_job(
  p_type text,
  p_payload jsonb,
  p_available_at timestamptz default now(),
  p_max_attempts integer default 5,
  p_idempotency_key text default null
)
returns private.jobs
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_job private.jobs;
begin
  insert into private.jobs (type, payload, available_at, max_attempts, idempotency_key)
  values (p_type, p_payload, p_available_at, p_max_attempts, p_idempotency_key)
  on conflict (idempotency_key) do nothing
  returning * into v_job;

  if v_job.id is null and p_idempotency_key is not null then
    select * into v_job from private.jobs where idempotency_key = p_idempotency_key;
  end if;

  return v_job;
end;
$$;

-- Trava de acesso: só service_role (client administrativo, exclusivamente
-- server-side) pode chamar estas funções. `anon`/`authenticated` (usuários
-- do navegador, mesmo autenticados) nunca enfileiram, capturam ou
-- concluem tarefas diretamente.
revoke execute on function public.enqueue_job(text, jsonb, timestamptz, integer, text) from public, anon, authenticated;
revoke execute on function public.claim_job(text, text[]) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.enqueue_job(text, jsonb, timestamptz, integer, text) to service_role;
grant execute on function public.claim_job(text, text[]) to service_role;
grant execute on function public.complete_job(uuid) to service_role;
grant execute on function public.fail_job(uuid, text, boolean) to service_role;
