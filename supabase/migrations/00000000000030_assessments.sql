-- Fase 5 — Avaliações e recuperação (doc 02 §6-8).
--
-- Números padrão desta fase vêm de 02-regras-finais-de-negocio.md e
-- 08-dados-iniciais-temporada-2026-2.md (fonte de verdade), não de
-- nenhuma referência histórica: 20 questões, 60 minutos, 14 dias, nota
-- total 10, média mínima 6.

create type public.assessment_type as enum ('final', 'recovery');
create type public.assessment_status as enum ('draft', 'open', 'closed');
create type public.answer_key_release_reason as enum ('all_submitted', 'deadline', 'manual');

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  season_volume_offering_id uuid not null references public.season_volume_offerings (id) on delete cascade,
  type public.assessment_type not null,
  linked_assessment_id uuid references public.assessments (id) on delete set null,
  title text not null,
  questions_count integer not null default 20,
  duration_minutes integer not null default 60,
  opens_at timestamptz,
  closes_at timestamptz,
  passing_grade numeric(4, 2) not null default 6,
  total_points numeric(4, 2) not null default 10,
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  status public.assessment_status not null default 'draft',
  answer_key_released_at timestamptz,
  answer_key_release_reason public.answer_key_release_reason,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_offering_type_unique unique (season_volume_offering_id, type),
  constraint assessments_questions_count_positive check (questions_count > 0),
  constraint assessments_duration_positive check (duration_minutes > 0)
);

comment on table public.assessments is
  'Cada oferta de volume tem no máximo uma avaliação "final" e uma '
  '"recovery" (doc 02 §6: "cada volume terá uma única avaliação final").';

create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

create table public.assessment_questions (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete restrict,
  points numeric(4, 2) not null,
  order_index integer not null,
  primary key (assessment_id, question_id)
);

-- Defesa em profundidade do doc 05 §12: "questões usadas na recuperação
-- devem ser diferentes das regulares" — checado já na inserção, não só
-- confiado à camada de serviço.
create or replace function public.enforce_recovery_questions_disjoint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.assessment_type;
  v_linked_id uuid;
  v_conflict boolean;
begin
  select type, linked_assessment_id into v_type, v_linked_id
  from public.assessments where id = new.assessment_id;

  if v_type = 'recovery' and v_linked_id is not null then
    select exists (
      select 1 from public.assessment_questions
      where assessment_id = v_linked_id and question_id = new.question_id
    ) into v_conflict;

    if v_conflict then
      raise exception
        'A questão % já está na avaliação regular vinculada — a recuperação exige questões diferentes (doc 05 §12).',
        new.question_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger assessment_questions_enforce_disjoint
  before insert on public.assessment_questions
  for each row execute function public.enforce_recovery_questions_disjoint();

-- Verdadeiro se o usuário autenticado tem matrícula ativa/em regularização/
-- aprovada especificamente na oferta informada (mais preciso que "no
-- volume" para avaliação, que é por oferta/temporada, não pelo catálogo
-- do volume inteiro).
create or replace function public.has_active_enrollment_in_offering(p_offering_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.enrollments
    where student_id = auth.uid()
      and season_volume_offering_id = p_offering_id
      and status in ('active', 'regularization', 'approved')
  );
$$;

alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;

create policy assessments_select_staff
  on public.assessments for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- Aluno vê metadados (título, contagem, duração, janela) da avaliação da
-- própria oferta, mas nunca as questões em si por aqui — só pelo
-- snapshot da própria tentativa (assessment_attempt_questions).
create policy assessments_select_student
  on public.assessments for select to authenticated
  using (
    public.has_role('student')
    and status = 'open'
    and public.has_active_enrollment_in_offering(season_volume_offering_id)
  );

create policy assessments_write_staff
  on public.assessments for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- assessment_questions é sempre staff-only — o aluno nunca vê a lista de
-- questões fora da própria tentativa já embaralhada/snapshotada.
create policy assessment_questions_select_staff
  on public.assessment_questions for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy assessment_questions_write_staff
  on public.assessment_questions for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));
