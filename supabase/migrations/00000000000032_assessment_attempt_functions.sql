-- Respostas e as funções SECURITY DEFINER que conduzem toda a tentativa
-- de avaliação. Nenhuma delas expõe a resposta correta antes da hora:
-- `start_assessment_attempt`/`get_assessment_attempt_questions` nunca
-- devolvem `is_correct`; só `get_assessment_attempt_review`, chamada
-- depois que o gabarito da avaliação foi liberado.
--
-- Padrão "primeira resposta vale" (confirmado no site de referência da
-- própria escola): `assessment_answers` só aceita INSERT; um segundo
-- envio para a mesma questão é um no-op silencioso, nunca sobrescreve.

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete restrict,
  selected_option_ids jsonb not null default '[]'::jsonb,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  constraint assessment_answers_attempt_question_unique unique (attempt_id, question_id)
);

alter table public.assessment_answers enable row level security;

create policy assessment_answers_select_own
  on public.assessment_answers for select to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = attempt_id and e.student_id = auth.uid()
  ));

create policy assessment_answers_select_staff
  on public.assessment_answers for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
-- Sem policy de insert/update para "authenticated": só as funções abaixo
-- (SECURITY DEFINER) escrevem aqui.

-- Finalização compartilhada por finalize_assessment_attempt (aluno,
-- dentro do prazo) e expire_assessment_attempts (varredura do Supabase
-- Cron, tentativas vencidas). Também aplica "nota maior substitui"
-- (doc 02 §8) na própria matrícula.
create or replace function private.finalize_attempt_scoring(
  p_attempt_id uuid,
  p_status public.assessment_attempt_status
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_score numeric(4, 2);
  v_correct integer;
  v_total integer;
  v_enrollment_id uuid;
begin
  select
    coalesce(sum(case when aa.is_correct then aq.points else 0 end), 0),
    count(*) filter (where aa.is_correct),
    count(aq.id)
  into v_score, v_correct, v_total
  from public.assessment_attempt_questions aq
  left join public.assessment_answers aa
    on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
  where aq.attempt_id = p_attempt_id;

  select enrollment_id into v_enrollment_id
  from public.assessment_attempts where id = p_attempt_id;

  update public.assessment_attempts
  set status = p_status, submitted_at = now(), score = v_score, correct_count = v_correct, total_count = v_total
  where id = p_attempt_id;

  update public.enrollments
  set final_grade = greatest(coalesce(final_grade, 0), v_score)
  where id = v_enrollment_id;
end;
$$;

-- Inicia a tentativa: valida elegibilidade geral, cria o snapshot
-- embaralhado (questões e alternativas), calcula o prazo no servidor.
create or replace function public.start_assessment_attempt(p_assessment_id uuid)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_assessment public.assessments%rowtype;
  v_enrollment_id uuid;
  v_existing_attempt public.assessment_attempts;
  v_attempt_count integer;
  v_max_attempts integer;
  v_new_attempt public.assessment_attempts;
  v_question record;
  v_position integer := 0;
  v_option_ids jsonb;
  v_correct_ids jsonb;
begin
  select * into v_assessment from public.assessments where id = p_assessment_id;

  if v_assessment.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  if v_assessment.status <> 'open' then
    raise exception 'Esta avaliação não está aberta.';
  end if;

  if v_assessment.opens_at is not null and now() < v_assessment.opens_at then
    raise exception 'Esta avaliação ainda não abriu.';
  end if;

  if v_assessment.closes_at is not null and now() > v_assessment.closes_at then
    raise exception 'O prazo desta avaliação já encerrou.';
  end if;

  select id into v_enrollment_id
  from public.enrollments
  where student_id = auth.uid()
    and season_volume_offering_id = v_assessment.season_volume_offering_id
    and status in ('active', 'regularization', 'approved')
  limit 1;

  if v_enrollment_id is null then
    raise exception 'Você não tem matrícula ativa nesta oferta de volume.';
  end if;

  select * into v_existing_attempt
  from public.assessment_attempts
  where assessment_id = p_assessment_id and enrollment_id = v_enrollment_id and status = 'in_progress'
  limit 1;

  if v_existing_attempt.id is not null then
    return v_existing_attempt;
  end if;

  select count(*) into v_attempt_count
  from public.assessment_attempts
  where assessment_id = p_assessment_id and enrollment_id = v_enrollment_id;

  v_max_attempts := 1;
  if exists (
    select 1 from public.assessment_exceptional_grants
    where assessment_id = p_assessment_id and enrollment_id = v_enrollment_id
  ) then
    v_max_attempts := 2;
  end if;

  if v_attempt_count >= v_max_attempts then
    raise exception 'Você já usou todas as tentativas disponíveis para esta avaliação.';
  end if;

  if v_assessment.type = 'recovery' and not public.is_recovery_path_completed(p_assessment_id, v_enrollment_id) then
    raise exception 'Conclua a trilha de revisão obrigatória antes de tentar a recuperação.';
  end if;

  insert into public.assessment_attempts (
    assessment_id, enrollment_id, attempt_kind, deadline_at
  ) values (
    p_assessment_id, v_enrollment_id,
    case when v_attempt_count > 0 then 'exceptional' else 'regular' end,
    now() + make_interval(mins => v_assessment.duration_minutes)
  )
  returning * into v_new_attempt;

  for v_question in
    select aq.question_id, aq.points, q.prompt, q.type, q.selection_mode
    from public.assessment_questions aq
    join public.question_bank q on q.id = aq.question_id
    where aq.assessment_id = p_assessment_id
    order by case when v_assessment.shuffle_questions then random() else aq.order_index end
  loop
    v_position := v_position + 1;

    select jsonb_agg(jsonb_build_object('optionId', o.id, 'label', o.label, 'orderIndex', o.order_index) order by
      case when v_assessment.shuffle_options then random() else o.order_index end)
    into v_option_ids
    from public.question_options o
    where o.question_id = v_question.question_id;

    select jsonb_agg(o.id)
    into v_correct_ids
    from public.question_options o
    where o.question_id = v_question.question_id and o.is_correct = true;

    insert into public.assessment_attempt_questions (
      attempt_id, question_id, position, prompt, question_type, selection_mode,
      options_snapshot, points, correct_option_ids_snapshot
    ) values (
      v_new_attempt.id, v_question.question_id, v_position, v_question.prompt,
      v_question.type::text, v_question.selection_mode,
      coalesce(v_option_ids, '[]'::jsonb), v_question.points, coalesce(v_correct_ids, '[]'::jsonb)
    );
  end loop;

  return v_new_attempt;
end;
$$;

revoke execute on function public.start_assessment_attempt(uuid) from public, anon;
grant execute on function public.start_assessment_attempt(uuid) to authenticated;

-- Questões da tentativa, sem resposta correta — o que a tela de prova usa.
create or replace function public.get_assessment_attempt_questions(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean;
begin
  select (e.student_id = auth.uid()) into v_owner
  from public.assessment_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'questionId', aq.question_id,
        'position', aq.position,
        'prompt', aq.prompt,
        'questionType', aq.question_type,
        'selectionMode', aq.selection_mode,
        'options', aq.options_snapshot,
        'answered', (aa.id is not null)
      )
      order by aq.position
    )
    from public.assessment_attempt_questions aq
    left join public.assessment_answers aa
      on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
    where aq.attempt_id = p_attempt_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_assessment_attempt_questions(uuid) from public, anon;
grant execute on function public.get_assessment_attempt_questions(uuid) to authenticated;

-- "Confirmar resposta": só a primeira conta. Corrige contra o snapshot
-- (nunca contra question_bank ao vivo) e recusa fora do prazo.
create or replace function public.submit_assessment_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner boolean;
  v_status public.assessment_attempt_status;
  v_deadline timestamptz;
  v_correct_ids jsonb;
  v_is_correct boolean;
  v_existing public.assessment_answers;
begin
  select (e.student_id = auth.uid()), a.status, a.deadline_at
  into v_owner, v_status, v_deadline
  from public.assessment_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'Esta tentativa já foi encerrada.';
  end if;

  if now() > v_deadline then
    perform private.finalize_attempt_scoring(p_attempt_id, 'expired');
    raise exception 'O tempo desta avaliação esgotou.';
  end if;

  select * into v_existing
  from public.assessment_answers
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if v_existing.id is not null then
    return jsonb_build_object('alreadyAnswered', true);
  end if;

  select correct_option_ids_snapshot into v_correct_ids
  from public.assessment_attempt_questions
  where attempt_id = p_attempt_id and question_id = p_question_id;

  v_is_correct := (
    p_selected_option_ids is not null
    and (select array(select jsonb_array_elements_text(p_selected_option_ids)))::text[]
        @> (select array(select jsonb_array_elements_text(v_correct_ids)))::text[]
    and (select array(select jsonb_array_elements_text(v_correct_ids)))::text[]
        @> (select array(select jsonb_array_elements_text(p_selected_option_ids)))::text[]
  );

  insert into public.assessment_answers (attempt_id, question_id, selected_option_ids, is_correct)
  values (p_attempt_id, p_question_id, p_selected_option_ids, v_is_correct)
  on conflict (attempt_id, question_id) do nothing;

  return jsonb_build_object('alreadyAnswered', false);
end;
$$;

revoke execute on function public.submit_assessment_answer(uuid, uuid, jsonb) from public, anon;
grant execute on function public.submit_assessment_answer(uuid, uuid, jsonb) to authenticated;

create or replace function public.finalize_assessment_attempt(p_attempt_id uuid)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_owner boolean;
  v_status public.assessment_attempt_status;
  v_result public.assessment_attempts;
begin
  select (e.student_id = auth.uid()), a.status
  into v_owner, v_status
  from public.assessment_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'Esta tentativa já foi encerrada.';
  end if;

  perform private.finalize_attempt_scoring(p_attempt_id, 'submitted');

  select * into v_result from public.assessment_attempts where id = p_attempt_id;
  return v_result;
end;
$$;

revoke execute on function public.finalize_assessment_attempt(uuid) from public, anon;
grant execute on function public.finalize_assessment_attempt(uuid) to authenticated;

-- Varredura de tentativas vencidas — alvo do Supabase Cron (próxima
-- migration). Não depende de sessão de usuário (auth.uid() é nulo aqui).
create or replace function public.expire_assessment_attempts()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_attempt record;
  v_count integer := 0;
begin
  for v_attempt in
    select id from public.assessment_attempts
    where status = 'in_progress' and deadline_at < now()
  loop
    perform private.finalize_attempt_scoring(v_attempt.id, 'expired');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.expire_assessment_attempts() from public, anon, authenticated;
grant execute on function public.expire_assessment_attempts() to service_role;

-- Revisão completa (com resposta correta) — só depois do gabarito
-- liberado, checado explicitamente aqui, não só na UI.
create or replace function public.get_assessment_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean;
  v_assessment_id uuid;
  v_released_at timestamptz;
begin
  select (e.student_id = auth.uid()), a.assessment_id
  into v_owner, v_assessment_id
  from public.assessment_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  select answer_key_released_at into v_released_at
  from public.assessments where id = v_assessment_id;

  if v_released_at is null then
    raise exception 'O gabarito desta avaliação ainda não foi liberado.';
  end if;

  -- explanation/bible_reference vêm ao vivo de question_bank (texto
  -- informativo, não integridade de correção — o que decide acerto/erro
  -- é sempre o snapshot, correct_option_ids_snapshot, nunca isto).
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'questionId', aq.question_id,
        'position', aq.position,
        'prompt', aq.prompt,
        'options', aq.options_snapshot,
        'correctOptionIds', aq.correct_option_ids_snapshot,
        'selectedOptionIds', coalesce(aa.selected_option_ids, '[]'::jsonb),
        'isCorrect', coalesce(aa.is_correct, false),
        'explanation', q.explanation,
        'bibleReference', q.bible_reference
      )
      order by aq.position
    )
    from public.assessment_attempt_questions aq
    left join public.assessment_answers aa
      on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
    left join public.question_bank q on q.id = aq.question_id
    where aq.attempt_id = p_attempt_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_assessment_attempt_review(uuid) from public, anon;
grant execute on function public.get_assessment_attempt_review(uuid) to authenticated;
