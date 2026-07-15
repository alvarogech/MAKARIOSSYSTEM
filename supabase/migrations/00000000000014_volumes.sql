-- Fase 2 — Administração acadêmica
-- Volumes (Essência, Caminho, Voz), pré-requisitos entre volumes e
-- exceções de pré-requisito auditadas. Ver doc 01/02 e
-- PLANO_TECNICO.md seção 4.2.

create table public.volumes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  order_index integer not null,
  description text,
  presencial_hours numeric not null default 16,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volumes_order_index_unique unique (order_index)
);

comment on table public.volumes is
  'Catálogo fixo de volumes da Escola Makários. Não confundir com a oferta '
  'de um volume numa temporada (season_volume_offerings).';

create trigger volumes_set_updated_at
  before update on public.volumes
  for each row execute function public.set_updated_at();

-- Grafo de pré-requisitos: volume_id exige prerequisite_volume_id.
-- Sequência padrão documentada: Essência → Caminho → Voz, mas modelado
-- como grafo (não coluna fixa) para permitir configuração futura sem
-- migration adicional.
create table public.volume_prerequisites (
  volume_id uuid not null references public.volumes (id) on delete cascade,
  prerequisite_volume_id uuid not null references public.volumes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (volume_id, prerequisite_volume_id),
  constraint volume_prerequisites_not_self check (volume_id <> prerequisite_volume_id)
);

-- Exceção de pré-requisito: sempre auditada (auditoria via trigger
-- genérico abaixo), sempre com justificativa e responsável.
create table public.prerequisite_exceptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  volume_id uuid not null references public.volumes (id) on delete restrict,
  missing_prerequisite_volume_id uuid not null references public.volumes (id) on delete restrict,
  justification text not null,
  authorized_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint prerequisite_exceptions_unique unique (student_id, volume_id, missing_prerequisite_volume_id)
);

comment on table public.prerequisite_exceptions is
  'Autorização individual da coordenação para matricular um aluno num '
  'volume sem ter concluído um pré-requisito específico. Sempre com '
  'justificativa — nunca criada silenciosamente pelo sistema.';

create trigger prerequisite_exceptions_audit
  after insert or delete on public.prerequisite_exceptions
  for each row execute function private.log_audit_event();

alter table public.volumes enable row level security;
alter table public.volume_prerequisites enable row level security;
alter table public.prerequisite_exceptions enable row level security;

-- Volumes/pré-requisitos: catálogo de referência, leitura liberada para
-- qualquer autenticado; escrita só coordenação/admin.
create policy volumes_select_authenticated
  on public.volumes for select to authenticated using (true);

create policy volumes_write_coordinator_admin
  on public.volumes for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create policy volume_prerequisites_select_authenticated
  on public.volume_prerequisites for select to authenticated using (true);

create policy volume_prerequisites_write_coordinator_admin
  on public.volume_prerequisites for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

-- Exceções: nunca públicas. O próprio aluno pode ver que tem uma exceção
-- concedida (transparência sobre a própria situação acadêmica);
-- coordenação/admin veem e criam todas.
create policy prerequisite_exceptions_select_own
  on public.prerequisite_exceptions for select to authenticated
  using (student_id = auth.uid());

create policy prerequisite_exceptions_select_coordinator_admin
  on public.prerequisite_exceptions for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy prerequisite_exceptions_insert_coordinator_admin
  on public.prerequisite_exceptions for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and authorized_by = auth.uid()
  );
