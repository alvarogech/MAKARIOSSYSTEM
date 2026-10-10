-- Pedidos de ajuda dos alunos (pagina publica /ajuda, sem login): login,
-- convite, volume ou turma errada, chamada... A coordenacao le e marca como
-- resolvido em /coordenacao/ajuda.
--
-- O CPF nao fica guardado: so o hash (o mesmo de enrollment_requests.cpf_hash,
-- para ligar o pedido a inscricao) e os 4 ultimos digitos. Quem grava e o
-- servidor (service_role); o navegador nunca escreve aqui direto.
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  cpf_hash text not null,
  cpf_last4 text not null check (cpf_last4 ~ '^[0-9]{4}$'),
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  problems text[] not null default '{}'
    check (problems <@ array['login', 'convite', 'turma_errada', 'dados_errados', 'chamada_erro', 'chamada_longe', 'presenca_faltando', 'outro']::text[]),
  message text check (message is null or char_length(message) <= 2000),
  enrollment_request_id uuid references public.enrollment_requests (id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint help_requests_has_content check (cardinality(problems) > 0 or message is not null)
);
create index if not exists help_requests_status_created on public.help_requests (status, created_at desc);

alter table public.help_requests enable row level security;
drop policy if exists help_requests_coordinator_admin_select on public.help_requests;
create policy help_requests_coordinator_admin_select
  on public.help_requests for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
drop policy if exists help_requests_coordinator_admin_update on public.help_requests;
create policy help_requests_coordinator_admin_update
  on public.help_requests for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
revoke all on public.help_requests from anon;
revoke all on public.help_requests from authenticated;
grant select on public.help_requests to authenticated;
grant update (status, resolved_at, resolved_by) on public.help_requests to authenticated;
grant all on public.help_requests to service_role;
