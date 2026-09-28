-- Suporte operacional para o dashboard de inscrições: visualização,
-- auditoria e capacidade por turma. Tudo aditivo e reversível — nenhuma
-- coluna existente é alterada, nenhum dado é reescrito.

-- 1) Visualização — diferente de status: uma inscrição pode ser vista pela
--    coordenação sem ainda ter sido aprovada/recusada. Global (não por
--    usuário individual): o esquema atual não tem uma tabela de leitura
--    por usuário para reaproveitar, e criar uma só para isto seria uma
--    mudança estrutural desproporcional ao pedido. Ver docs/DECISIONS.md.
alter table public.enrollment_requests
  add column viewed_at timestamptz,
  add column viewed_by uuid references auth.users (id) on delete set null;

-- 2) Auditoria — reaproveita o mesmo gatilho genérico já usado em
--    profiles/user_roles/invitations (private.log_audit_event), em vez de
--    inventar um mecanismo novo. Cobre mudança de status, de visualização
--    e qualquer outra atualização de linha.
create trigger enrollment_requests_audit
  after update on public.enrollment_requests
  for each row execute function private.log_audit_event();

-- 3) Capacidade por turma (curso + dia da semana) da temporada corrente.
--    Não reaproveita classes.capacity: `classes` pertence ao sistema real
--    de matrícula (season_volume_offering + class_template), com
--    granularidade e cardinalidade diferentes das inscrições (que só
--    conhecem volume_slug + schedule_slug, não um class_id). Criar uma
--    tabela própria, pequena e específica evita um join frágil/incorreto
--    entre dois sistemas paralelos. Ver docs/DECISIONS.md.
create table public.enrollment_turma_capacity (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  volume_slug text not null check (volume_slug in ('essencia', 'caminho', 'voz')),
  schedule_slug text not null check (schedule_slug in ('terca_quinta', 'sabado')),
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, volume_slug, schedule_slug)
);

create trigger enrollment_turma_capacity_set_updated_at
  before update on public.enrollment_turma_capacity
  for each row execute function public.set_updated_at();

alter table public.enrollment_turma_capacity enable row level security;

create policy enrollment_turma_capacity_manage_coordinator_admin
  on public.enrollment_turma_capacity for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

comment on table public.enrollment_turma_capacity is
  'Capacidade configurada pela coordenação por curso+turma, por temporada. Ausência de linha = capacidade não configurada (não é o mesmo que zero vagas).';
comment on column public.enrollment_requests.viewed_at is
  'Quando a inscrição foi aberta pela primeira vez na coordenação. Nulo = ainda não visualizada. Visualização é global, não por usuário.';
