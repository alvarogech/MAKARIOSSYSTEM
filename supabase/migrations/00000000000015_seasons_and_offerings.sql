-- Temporadas, modelos de horário e oferta de volume por temporada
-- (season_volume_offerings — PLANO_TECNICO.md seção 4.5/8/9:
-- Season → SeasonVolumeOffering → Classes → ClassMeetings).

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  status text not null default 'planning'
    check (status in ('planning', 'open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();

-- Modelos de horário (doc 08 §4/§5). `total_academic_minutes` deve bater
-- com meetings_count * academic_minutes_per_meeting — checado abaixo.
create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  weekdays text[] not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  meetings_count integer not null,
  academic_minutes_per_meeting integer not null,
  total_academic_minutes integer not null,
  created_at timestamptz not null default now(),
  constraint class_templates_total_minutes_consistent
    check (total_academic_minutes = meetings_count * academic_minutes_per_meeting)
);

comment on table public.class_templates is
  'Modelos de horário (terça/quinta, sábado, personalizado). Carga '
  'acadêmica em minutos, nunca em "quantidade de encontros" — ver doc 02 §9.';

-- Oferta de um volume dentro de uma temporada. As turmas pertencem a uma
-- oferta, nunca diretamente a season+volume soltos.
create table public.season_volume_offerings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  volume_id uuid not null references public.volumes (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed')),
  assessment_open_at timestamptz,
  assessment_close_at timestamptz,
  recovery_open_at timestamptz,
  recovery_close_at timestamptz,
  academic_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint season_volume_offerings_unique unique (season_id, volume_id)
);

create trigger season_volume_offerings_set_updated_at
  before update on public.season_volume_offerings
  for each row execute function public.set_updated_at();

alter table public.seasons enable row level security;
alter table public.class_templates enable row level security;
alter table public.season_volume_offerings enable row level security;

create policy seasons_select_authenticated
  on public.seasons for select to authenticated using (true);

create policy seasons_write_coordinator_admin
  on public.seasons for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create policy class_templates_select_authenticated
  on public.class_templates for select to authenticated using (true);

create policy class_templates_write_coordinator_admin
  on public.class_templates for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create policy season_volume_offerings_select_authenticated
  on public.season_volume_offerings for select to authenticated using (true);

create policy season_volume_offerings_write_coordinator_admin
  on public.season_volume_offerings for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
