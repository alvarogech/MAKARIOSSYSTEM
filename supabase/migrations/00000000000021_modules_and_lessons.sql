-- Fase 3 — Conteúdo e área do aluno
-- Estrutura: Volume → Módulo → Aula → Conteúdo (doc 04 §7 CON-01).

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  volume_id uuid not null references public.volumes (id) on delete cascade,
  name text not null,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modules_volume_order_unique unique (volume_id, order_index)
);

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  name text not null,
  objectives text,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_module_order_unique unique (module_id, order_index)
);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

alter table public.modules enable row level security;
alter table public.lessons enable row level security;

-- Leitura liberada para qualquer autenticado (a estrutura em si — nomes de
-- módulo/aula — não é sensível; o que é restrito é o conteúdo dentro
-- delas, ver migration seguinte). Escrita: coordenação/admin/editor —
-- nunca professor (doc 03 §3 "não pode: alterar conteúdo oficial").
create policy modules_select_authenticated
  on public.modules for select to authenticated using (true);

create policy modules_write_content_staff
  on public.modules for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy lessons_select_authenticated
  on public.lessons for select to authenticated using (true);

create policy lessons_write_content_staff
  on public.lessons for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));
