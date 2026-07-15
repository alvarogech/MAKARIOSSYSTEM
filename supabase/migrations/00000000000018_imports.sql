-- Importação de planilhas (XLSX/CSV) de alunos — doc 06 §5,
-- PLANO_TECNICO.md seção 15.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'students' check (type in ('students')),
  file_name text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'completed_with_errors', 'failed')),
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  error_rows integer not null default 0,
  season_volume_offering_id uuid references public.season_volume_offerings (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger imports_set_updated_at
  before update on public.imports
  for each row execute function public.set_updated_at();

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports (id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'error')),
  errors text[] not null default '{}',
  created_user_id uuid references auth.users (id) on delete set null,
  created_enrollment_id uuid references public.enrollments (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint import_rows_unique unique (import_id, row_number)
);

alter table public.imports enable row level security;
alter table public.import_rows enable row level security;

-- Importação é ação administrativa/acadêmica sensível (cria usuários e
-- matrículas em lote) — só coordenação/admin, nunca pública.
create policy imports_select_coordinator_admin
  on public.imports for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy imports_insert_coordinator_admin
  on public.imports for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and created_by = auth.uid()
  );

create policy imports_update_coordinator_admin
  on public.imports for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create policy import_rows_select_coordinator_admin
  on public.import_rows for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy import_rows_write_coordinator_admin
  on public.import_rows for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
