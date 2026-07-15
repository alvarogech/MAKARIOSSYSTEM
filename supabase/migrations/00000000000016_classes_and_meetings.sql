-- Turmas, encontros e o vínculo (único) do professor com a turma/encontro.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  season_volume_offering_id uuid not null references public.season_volume_offerings (id) on delete restrict,
  class_template_id uuid not null references public.class_templates (id) on delete restrict,
  name text not null,
  location text,
  capacity integer,
  status text not null default 'planning'
    check (status in ('planning', 'open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.classes is
  'Turma. Pertence sempre a uma season_volume_offering (nunca referencia '
  'season/volume soltos) — PLANO_TECNICO.md seção 8.';

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- Encontro presencial. `academic_minutes` é o dado que realmente importa
-- para o cálculo de frequência (doc 02 §9) — nunca "quantidade de
-- encontros".
create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  sequence integer not null,
  meeting_date date,
  start_time time,
  end_time time,
  break_minutes integer not null default 0,
  academic_minutes integer not null,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'canceled')),
  created_at timestamptz not null default now(),
  constraint class_meetings_sequence_unique unique (class_id, sequence),
  constraint class_meetings_academic_minutes_positive check (academic_minutes > 0)
);

-- Única fonte de verdade do vínculo/escopo do professor — nunca em
-- user_roles (Fase 1, PLANO_TECNICO.md seção 3/4/8).
create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  meeting_id uuid references public.class_meetings (id) on delete cascade,
  function text not null default 'regente',
  created_at timestamptz not null default now()
);

comment on table public.teacher_assignments is
  'Vínculo do professor com turma (meeting_id nulo) ou com um encontro '
  'específico. Fonte única de verdade do escopo do professor — nunca '
  'derivar de user_roles.';

-- Duas policies de unicidade (não dá para usar UNIQUE simples com coluna
-- nula de forma direta): um vínculo geral (turma inteira) não se repete, e
-- um vínculo pontual (turma+encontro) também não.
create unique index teacher_assignments_class_wide_unique
  on public.teacher_assignments (teacher_id, class_id)
  where meeting_id is null;

create unique index teacher_assignments_meeting_specific_unique
  on public.teacher_assignments (teacher_id, class_id, meeting_id)
  where meeting_id is not null;

alter table public.classes enable row level security;
alter table public.class_meetings enable row level security;
alter table public.teacher_assignments enable row level security;

-- Turmas/encontros: leitura liberada para autenticado (não é dado
-- sensível — nome de turma, horário, local), escrita só coordenação/admin.
create policy classes_select_authenticated
  on public.classes for select to authenticated using (true);

create policy classes_write_coordinator_admin
  on public.classes for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create policy class_meetings_select_authenticated
  on public.class_meetings for select to authenticated using (true);

create policy class_meetings_write_coordinator_admin
  on public.class_meetings for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

-- Vínculo de professor: o próprio professor vê os próprios vínculos
-- (precisa saber quais turmas são suas); coordenação/admin veem e
-- gerenciam todos. Nunca escrito pelo próprio professor.
create policy teacher_assignments_select_own
  on public.teacher_assignments for select to authenticated
  using (teacher_id = auth.uid());

create policy teacher_assignments_select_coordinator_admin
  on public.teacher_assignments for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy teacher_assignments_write_coordinator_admin
  on public.teacher_assignments for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create trigger teacher_assignments_audit
  after insert or delete on public.teacher_assignments
  for each row execute function private.log_audit_event();
