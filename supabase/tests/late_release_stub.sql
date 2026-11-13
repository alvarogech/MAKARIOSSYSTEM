-- Banco de mentira: so as tabelas e funcoes que start_assessment_attempt e a migracao 087 tocam.
-- Serve para rodar supabase/tests/late_release_cenarios.sql num Postgres LOCAL e descartavel.
-- NUNCA rodar em Supabase de producao.
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
create schema auth; create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
create function public.has_role(r text) returns boolean language sql stable as $$ select coalesce(current_setting('app.role', true) = r, false) $$;
create table private.audit_logs(id serial primary key, op text, entity text, entity_id text);
create function private.log_audit_event() returns trigger language plpgsql security definer as $$ begin insert into private.audit_logs(op,entity,entity_id) values (tg_op,tg_table_name,coalesce(new.id,old.id)::text); return coalesce(new,old); end $$;
create table public.assessments(id uuid primary key default gen_random_uuid(), status text, opens_at timestamptz, closes_at timestamptz, season_volume_offering_id uuid, title text, type text default 'final', duration_minutes int default 60, shuffle_questions boolean default false, shuffle_options boolean default false);
create table public.enrollments(id uuid primary key default gen_random_uuid(), student_id uuid, season_volume_offering_id uuid, status text);
create table public.assessment_attempts(id uuid primary key default gen_random_uuid(), assessment_id uuid, enrollment_id uuid, status text default 'in_progress', attempt_kind text, deadline_at timestamptz, created_at timestamptz default now());
create table public.assessment_exceptional_grants(assessment_id uuid, enrollment_id uuid);
create table public.assessment_questions(assessment_id uuid, question_id uuid, points numeric, order_index int);
create table public.question_bank(id uuid primary key, prompt text, type text, selection_mode text);
create table public.question_options(id uuid primary key default gen_random_uuid(), question_id uuid, label text, order_index int, is_correct boolean);
create table public.assessment_attempt_questions(attempt_id uuid, question_id uuid, position int, prompt text, question_type text, selection_mode text, options_snapshot jsonb, points numeric, correct_option_ids_snapshot jsonb);
create function public.is_recovery_path_completed(a uuid, e uuid) returns boolean language sql as $$ select true $$;
grant select on public.enrollments, public.assessments to authenticated;

-- Parte 3 (gabarito): colunas, tabela de respostas e as politicas ORIGINAIS das migracoes 031 e 032.
alter table public.assessments add column if not exists answer_key_released_at timestamptz;
alter table public.question_bank add column if not exists explanation text, add column if not exists bible_reference text;
create table if not exists public.assessment_answers(id uuid primary key default gen_random_uuid(), attempt_id uuid not null, question_id uuid not null, selected_option_ids jsonb not null default '[]'::jsonb, is_correct boolean not null, answered_at timestamptz not null default now());
alter table public.assessment_attempt_questions enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.assessment_attempts enable row level security;
grant select on public.assessment_attempt_questions, public.assessment_answers, public.assessment_attempts to authenticated;
drop policy if exists assessment_attempts_select_own on public.assessment_attempts;
create policy assessment_attempts_select_own on public.assessment_attempts for select to authenticated using (true);
drop policy if exists assessment_attempt_questions_select_own on public.assessment_attempt_questions;
create policy assessment_attempt_questions_select_own on public.assessment_attempt_questions for select to authenticated
  using (exists (select 1 from public.assessment_attempts a join public.enrollments e on e.id = a.enrollment_id where a.id = attempt_id and e.student_id = auth.uid()));
drop policy if exists assessment_attempt_questions_select_staff on public.assessment_attempt_questions;
create policy assessment_attempt_questions_select_staff on public.assessment_attempt_questions for select to authenticated using (public.has_role('coordinator') or public.has_role('admin'));
drop policy if exists assessment_answers_select_own on public.assessment_answers;
create policy assessment_answers_select_own on public.assessment_answers for select to authenticated
  using (exists (select 1 from public.assessment_attempts a join public.enrollments e on e.id = a.enrollment_id where a.id = attempt_id and e.student_id = auth.uid()));
drop policy if exists assessment_answers_select_staff on public.assessment_answers;
create policy assessment_answers_select_staff on public.assessment_answers for select to authenticated using (public.has_role('coordinator') or public.has_role('admin'));
