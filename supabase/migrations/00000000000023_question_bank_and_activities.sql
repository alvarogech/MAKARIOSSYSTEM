-- Banco de questões e exercícios de fixação (doc 02 §5).
--
-- Regra de segurança preservada desde a Fase 1 (mesmo antes de avaliações
-- existirem): a resposta correta nunca é consultável pelo aluno antes do
-- envio. `question_bank`/`question_options` são bloqueados por RLS para
-- quem não é da equipe de conteúdo — o aluno só enxerga questões/
-- alternativas através das funções SECURITY DEFINER abaixo, que nunca
-- devolvem `is_correct` antes da correção.

create type public.question_type as enum (
  'multiple_choice',
  'true_false',
  'matching',
  'ordering',
  'fill_in_blank'
);

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  volume_id uuid references public.volumes (id) on delete set null,
  module_id uuid references public.modules (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  type public.question_type not null,
  prompt text not null,
  explanation text,
  bible_reference text,
  topic text,
  difficulty text not null default 'medio' check (difficulty in ('facil', 'medio', 'dificil')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.question_bank is
  'Nunca discursiva (doc 02 §5.7 / §11). Sem RLS de leitura para aluno — '
  'ver get_activity_questions_for_attempt().';

create trigger question_bank_set_updated_at
  before update on public.question_bank
  for each row execute function public.set_updated_at();

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank (id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  order_index integer not null
);

-- Exercício de fixação: nunca vale nota (doc 02 §5.1). `blocks_progress`
-- espelha "podem bloquear o avanço" (doc 02 §5.3).
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  instructions text,
  max_attempts integer,
  blocks_progress boolean not null default false,
  show_feedback_after_submit boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_max_attempts_positive check (max_attempts is null or max_attempts > 0)
);

comment on table public.activities is
  'Exercício de fixação — nunca gera nota de matrícula. max_attempts nulo = ilimitado.';

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create table public.activity_questions (
  activity_id uuid not null references public.activities (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete restrict,
  order_index integer not null,
  primary key (activity_id, question_id)
);

create table public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  correct_count integer,
  total_count integer,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  created_at timestamptz not null default now()
);

create index activity_attempts_enrollment_activity_idx
  on public.activity_attempts (enrollment_id, activity_id);

create table public.activity_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.activity_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete restrict,
  selected_option_ids uuid[] not null default '{}',
  is_correct boolean,
  created_at timestamptz not null default now(),
  constraint activity_answers_attempt_question_unique unique (attempt_id, question_id)
);

alter table public.question_bank enable row level security;
alter table public.question_options enable row level security;
alter table public.activities enable row level security;
alter table public.activity_questions enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.activity_answers enable row level security;

-- Banco de questões: só a equipe de conteúdo. Nenhuma policy para
-- student/teacher — acesso é sempre via as funções abaixo.
create policy question_bank_select_staff
  on public.question_bank for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy question_bank_write_staff
  on public.question_bank for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy question_options_select_staff
  on public.question_options for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy question_options_write_staff
  on public.question_options for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- Atividades: mesma visibilidade de conteúdo (staff vê tudo; aluno só
-- publicada e só se tiver matrícula ativa no volume da aula).
create policy activities_select_staff
  on public.activities for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy activities_select_student
  on public.activities for select to authenticated
  using (
    public.has_role('student')
    and status = 'published'
    and public.has_active_enrollment_in_volume(
      (select m.volume_id from public.lessons l join public.modules m on m.id = l.module_id where l.id = lesson_id)
    )
  );

create policy activities_write_staff
  on public.activities for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy activity_questions_select_staff
  on public.activity_questions for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy activity_questions_write_staff
  on public.activity_questions for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- Tentativas/respostas: o próprio aluno (dono da matrícula) e a equipe de
-- conteúdo/coordenação podem ler; só o dono cria/atualiza a própria
-- tentativa (via as funções RPC abaixo, não INSERT direto do cliente).
create policy activity_attempts_select_own
  on public.activity_attempts for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy activity_attempts_select_staff
  on public.activity_attempts for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy activity_answers_select_own
  on public.activity_answers for select to authenticated
  using (exists (
    select 1 from public.activity_attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = attempt_id and e.student_id = auth.uid()
  ));

create policy activity_answers_select_staff
  on public.activity_answers for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- =============================================================================
-- Funções server-side para tentativa de exercício. Nenhuma delas expõe
-- `is_correct` de uma questão antes do envio da tentativa.
-- =============================================================================

-- Inicia (ou reaproveita) uma tentativa em andamento. SECURITY INVOKER —
-- o INSERT respeita a ausência de policy de insert direta (ver abaixo,
-- não há policy de insert para "authenticated" em activity_attempts:
-- ninguém insere direto, só via esta função, que roda como o próprio
-- usuário mas grava só se ele for dono da matrícula, checado aqui).
create or replace function public.start_activity_attempt(p_activity_id uuid)
returns public.activity_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
  v_attempt public.activity_attempts;
  v_max_attempts integer;
  v_attempt_count integer;
begin
  select e.id
  into v_enrollment_id
  from public.enrollments e
  join public.season_volume_offerings o on o.id = e.season_volume_offering_id
  join public.activities act on act.id = p_activity_id
  join public.lessons l on l.id = act.lesson_id
  join public.modules m on m.id = l.module_id
  where e.student_id = auth.uid()
    and o.volume_id = m.volume_id
    and e.status in ('active', 'regularization', 'approved')
  limit 1;

  if v_enrollment_id is null then
    raise exception 'Você não tem matrícula ativa no volume deste exercício.';
  end if;

  select * into v_attempt
  from public.activity_attempts
  where enrollment_id = v_enrollment_id
    and activity_id = p_activity_id
    and status = 'in_progress'
  limit 1;

  if v_attempt.id is not null then
    return v_attempt;
  end if;

  select max_attempts into v_max_attempts from public.activities where id = p_activity_id;

  if v_max_attempts is not null then
    select count(*) into v_attempt_count
    from public.activity_attempts
    where enrollment_id = v_enrollment_id and activity_id = p_activity_id;

    if v_attempt_count >= v_max_attempts then
      raise exception 'Número máximo de tentativas atingido para este exercício.';
    end if;
  end if;

  insert into public.activity_attempts (enrollment_id, activity_id)
  values (v_enrollment_id, p_activity_id)
  returning * into v_attempt;

  return v_attempt;
end;
$$;

revoke execute on function public.start_activity_attempt(uuid) from public, anon;
grant execute on function public.start_activity_attempt(uuid) to authenticated;

-- Devolve as questões da tentativa SEM revelar is_correct — é a única
-- forma pela qual um aluno enxerga o conteúdo de uma questão.
create or replace function public.get_activity_questions_for_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean;
  v_activity_id uuid;
  v_result jsonb;
begin
  select (e.student_id = auth.uid()), a.activity_id
  into v_owner, v_activity_id
  from public.activity_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'questionId', q.id,
      'type', q.type,
      'prompt', q.prompt,
      'orderIndex', aq.order_index,
      'options', (
        select jsonb_agg(
          jsonb_build_object('optionId', o.id, 'label', o.label, 'orderIndex', o.order_index)
          order by o.order_index
        )
        from public.question_options o
        where o.question_id = q.id
      )
    )
    order by aq.order_index
  )
  into v_result
  from public.activity_questions aq
  join public.question_bank q on q.id = aq.question_id
  where aq.activity_id = v_activity_id;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke execute on function public.get_activity_questions_for_attempt(uuid) from public, anon;
grant execute on function public.get_activity_questions_for_attempt(uuid) to authenticated;

-- Corrige e encerra a tentativa. `p_answers` é um array de
-- {"questionId": uuid, "selectedOptionIds": uuid[]}. Correção sempre
-- server-side — o cliente nunca envia se acertou ou não.
create or replace function public.submit_activity_attempt(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner boolean;
  v_activity_id uuid;
  v_show_feedback boolean;
  v_answer jsonb;
  v_question_id uuid;
  v_selected uuid[];
  v_correct_ids uuid[];
  v_is_correct boolean;
  v_correct_count integer := 0;
  v_total_count integer := 0;
  v_result jsonb := '[]'::jsonb;
begin
  select (e.student_id = auth.uid()), a.activity_id
  into v_owner, v_activity_id
  from public.activity_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id and a.status = 'in_progress';

  if v_owner is not true then
    raise exception 'Tentativa não encontrada, já enviada, ou não pertence a este usuário.';
  end if;

  select show_feedback_after_submit into v_show_feedback
  from public.activities where id = v_activity_id;

  for v_answer in select * from jsonb_array_elements(p_answers)
  loop
    v_question_id := (v_answer ->> 'questionId')::uuid;
    select array(select jsonb_array_elements_text(v_answer -> 'selectedOptionIds'))::uuid[]
    into v_selected;

    select array_agg(id) into v_correct_ids
    from public.question_options
    where question_id = v_question_id and is_correct = true;

    v_is_correct := (
      v_selected is not null
      and v_correct_ids is not null
      and v_selected <@ v_correct_ids
      and v_correct_ids <@ v_selected
    );

    insert into public.activity_answers (attempt_id, question_id, selected_option_ids, is_correct)
    values (p_attempt_id, v_question_id, coalesce(v_selected, '{}'), v_is_correct)
    on conflict (attempt_id, question_id)
    do update set selected_option_ids = excluded.selected_option_ids, is_correct = excluded.is_correct;

    v_total_count := v_total_count + 1;
    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    if v_show_feedback then
      v_result := v_result || jsonb_build_object(
        'questionId', v_question_id,
        'isCorrect', v_is_correct,
        'correctOptionIds', v_correct_ids,
        'explanation', (select explanation from public.question_bank where id = v_question_id)
      );
    end if;
  end loop;

  update public.activity_attempts
  set status = 'submitted',
      submitted_at = now(),
      correct_count = v_correct_count,
      total_count = v_total_count
  where id = p_attempt_id;

  return jsonb_build_object(
    'correctCount', v_correct_count,
    'totalCount', v_total_count,
    'showFeedback', coalesce(v_show_feedback, true),
    'answers', v_result
  );
end;
$$;

revoke execute on function public.submit_activity_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_activity_attempt(uuid, jsonb) to authenticated;
