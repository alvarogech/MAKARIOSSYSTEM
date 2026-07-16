-- Regras de liberação de conteúdo (doc 02 §3.3) e progresso do aluno por
-- conteúdo (doc 02 §4.6 / §5). A AVALIAÇÃO da regra (liberado ou não, para
-- um aluno específico, agora) é feita em código (função pura
-- `src/services/contentRelease.ts`), não em SQL — aqui só o armazenamento.

create type public.release_rule_type as enum (
  'immediate',
  'date',
  'manual',
  'after_content',
  'after_activity',
  'after_meeting'
);

create table public.release_rules (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  type public.release_rule_type not null,
  release_at timestamptz,
  required_content_id uuid references public.contents (id) on delete set null,
  required_activity_id uuid references public.activities (id) on delete set null,
  required_meeting_id uuid references public.class_meetings (id) on delete set null,
  released_manually boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.release_rules is
  'Uma linha por regra; um conteúdo pode ter mais de uma regra (a Fase 3 '
  'trata "liberado" como OR entre as regras do conteúdo — qualquer uma '
  'satisfeita libera).';

create trigger release_rules_set_updated_at
  before update on public.release_rules
  for each row execute function public.set_updated_at();

create table public.content_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  started_at timestamptz,
  last_position_seconds integer,
  percent numeric(5, 2) not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint content_progress_enrollment_content_unique unique (enrollment_id, content_id),
  constraint content_progress_percent_range check (percent between 0 and 100)
);

create trigger content_progress_set_updated_at
  before update on public.content_progress
  for each row execute function public.set_updated_at();

alter table public.release_rules enable row level security;
alter table public.content_progress enable row level security;

-- Regras de liberação: mesma visibilidade do conteúdo pai — quem pode ver
-- o conteúdo pode ver por que ele está (ou não) liberado. Escrita só
-- staff, exceto o toggle "released_manually", que a coordenação também
-- faz (já coberto por has_role('coordinator')).
create policy release_rules_select_if_content_visible
  on public.release_rules for select to authenticated
  using (exists (select 1 from public.contents c where c.id = content_id));

create policy release_rules_write_staff
  on public.release_rules for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- Progresso: só o dono da matrícula lê/escreve o próprio; staff lê tudo
-- (acompanhamento pedagógico). Nunca escrita por professor ou por outro
-- aluno.
create policy content_progress_select_own
  on public.content_progress for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy content_progress_select_staff
  on public.content_progress for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor') or public.has_role('teacher'));

create policy content_progress_upsert_own
  on public.content_progress for insert to authenticated
  with check (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy content_progress_update_own
  on public.content_progress for update to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));
