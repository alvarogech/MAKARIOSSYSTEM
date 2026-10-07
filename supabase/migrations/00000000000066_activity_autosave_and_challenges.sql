-- Exercícios de fixação com uma questão por vez: a resposta é salva a cada seleção
-- (retoma a mesma tentativa depois de atualizar/reconectar), cada resposta pode ser
-- verificada na hora (explicação + referência), a PRIMEIRA resposta avaliada fica
-- guardada separada das revisões posteriores, e o desafio prático tem conclusão
-- ("Pratiquei") com nota PRIVADA que nem coordenação nem professor enxergam.

alter table public.activity_answers
  add column if not exists first_selected_option_ids uuid[],
  add column if not exists first_is_correct boolean,
  add column if not exists checked_at timestamptz;

-- 1. Só inicia tentativa de exercício PUBLICADO do volume em que o aluno está matriculado.
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
    and act.status = 'published'
    and e.status in ('active', 'regularization', 'approved')
  limit 1;

  if v_enrollment_id is null then
    raise exception 'Este exercício não está disponível para você.';
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

-- 2. Questões da tentativa (sem gabarito) — agora com o modo de seleção (uma ou duas corretas).
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
      'selectionMode', q.selection_mode,
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

-- 3. Salva a seleção (sem corrigir). Trocar a seleção depois de verificar zera a verificação,
--    mas a PRIMEIRA resposta avaliada continua guardada.
create or replace function public.save_activity_answer(p_attempt_id uuid, p_question_id uuid, p_selected uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_selected uuid[];
  v_valid integer;
  v_mode text;
begin
  select a.activity_id into v_activity_id
  from public.activity_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id and a.status = 'in_progress' and e.student_id = auth.uid();

  if v_activity_id is null then
    raise exception 'Tentativa não encontrada, já enviada, ou não pertence a este usuário.';
  end if;

  if not exists (
    select 1 from public.activity_questions where activity_id = v_activity_id and question_id = p_question_id
  ) then
    raise exception 'Questão não pertence a este exercício.';
  end if;

  select array(select distinct unnest(coalesce(p_selected, '{}'::uuid[]))) into v_selected;

  select count(*) into v_valid
  from public.question_options where question_id = p_question_id and id = any (v_selected);
  if v_valid <> coalesce(cardinality(v_selected), 0) then
    raise exception 'Alternativa inválida.';
  end if;

  select selection_mode into v_mode from public.question_bank where id = p_question_id;
  if v_mode = 'single' and cardinality(v_selected) > 1 then
    raise exception 'Esta questão aceita apenas uma resposta.';
  end if;

  insert into public.activity_answers (attempt_id, question_id, selected_option_ids)
  values (p_attempt_id, p_question_id, v_selected)
  on conflict (attempt_id, question_id)
  do update set selected_option_ids = excluded.selected_option_ids, is_correct = null, checked_at = null;
end;
$$;

-- 4. Verifica UMA resposta já salva: devolve acerto, gabarito, explicação e referência.
--    Só em exercício que mostra feedback; guarda a primeira resposta avaliada.
create or replace function public.check_activity_answer(p_attempt_id uuid, p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_show_feedback boolean;
  v_selected uuid[];
  v_correct_ids uuid[];
  v_is_correct boolean;
begin
  select a.activity_id into v_activity_id
  from public.activity_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id and e.student_id = auth.uid();

  if v_activity_id is null then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  select show_feedback_after_submit into v_show_feedback from public.activities where id = v_activity_id;
  if v_show_feedback is not true then
    raise exception 'Este exercício só mostra a correção ao final.';
  end if;

  select selected_option_ids into v_selected
  from public.activity_answers where attempt_id = p_attempt_id and question_id = p_question_id;
  if v_selected is null or cardinality(v_selected) = 0 then
    raise exception 'Marque uma resposta antes de verificar.';
  end if;

  select array_agg(id) into v_correct_ids
  from public.question_options where question_id = p_question_id and is_correct = true;

  v_is_correct := v_correct_ids is not null and v_selected <@ v_correct_ids and v_correct_ids <@ v_selected;

  update public.activity_answers
  set is_correct = v_is_correct,
      checked_at = now(),
      first_selected_option_ids = coalesce(first_selected_option_ids, v_selected),
      first_is_correct = coalesce(first_is_correct, v_is_correct)
  where attempt_id = p_attempt_id and question_id = p_question_id;

  return jsonb_build_object(
    'isCorrect', v_is_correct,
    'correctOptionIds', to_jsonb(v_correct_ids),
    'explanation', (select explanation from public.question_bank where id = p_question_id),
    'bibleReference', (select bible_reference from public.question_bank where id = p_question_id)
  );
end;
$$;

-- 5. Respostas salvas da tentativa (para retomar). O gabarito só vem para o que já foi
--    verificado — ou para tudo, se a tentativa já foi enviada.
create or replace function public.get_activity_attempt_answers(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean;
  v_status text;
  v_activity_id uuid;
  v_show_feedback boolean;
  v_result jsonb;
begin
  select (e.student_id = auth.uid()), a.status, a.activity_id
  into v_owner, v_status, v_activity_id
  from public.activity_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception 'Tentativa não encontrada ou não pertence a este usuário.';
  end if;

  select show_feedback_after_submit into v_show_feedback from public.activities where id = v_activity_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'questionId', ans.question_id,
      'selectedOptionIds', to_jsonb(ans.selected_option_ids),
      'revealed', (v_show_feedback and ans.is_correct is not null and (ans.checked_at is not null or v_status = 'submitted')),
      'isCorrect', case when v_show_feedback and ans.is_correct is not null and (ans.checked_at is not null or v_status = 'submitted') then ans.is_correct end,
      'correctOptionIds', case when v_show_feedback and ans.is_correct is not null and (ans.checked_at is not null or v_status = 'submitted')
        then (select to_jsonb(array_agg(o.id)) from public.question_options o where o.question_id = ans.question_id and o.is_correct) end,
      'explanation', case when v_show_feedback and ans.is_correct is not null and (ans.checked_at is not null or v_status = 'submitted')
        then (select q.explanation from public.question_bank q where q.id = ans.question_id) end,
      'bibleReference', case when v_show_feedback and ans.is_correct is not null and (ans.checked_at is not null or v_status = 'submitted')
        then (select q.bible_reference from public.question_bank q where q.id = ans.question_id) end
    )
  ), '[]'::jsonb)
  into v_result
  from public.activity_answers ans
  where ans.attempt_id = p_attempt_id;

  return v_result;
end;
$$;

-- 6. Envio final: corrige tudo no servidor e guarda a primeira resposta avaliada de cada questão.
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

    if not exists (
      select 1 from public.activity_questions where activity_id = v_activity_id and question_id = v_question_id
    ) then
      raise exception 'Questão não pertence a este exercício.';
    end if;

    select array(select jsonb_array_elements_text(v_answer -> 'selectedOptionIds'))::uuid[]
    into v_selected;

    select array_agg(id) into v_correct_ids
    from public.question_options
    where question_id = v_question_id and is_correct = true;

    v_is_correct := (
      v_selected is not null
      and cardinality(v_selected) > 0
      and v_correct_ids is not null
      and v_selected <@ v_correct_ids
      and v_correct_ids <@ v_selected
    );

    insert into public.activity_answers
      (attempt_id, question_id, selected_option_ids, is_correct, first_selected_option_ids, first_is_correct)
    values (p_attempt_id, v_question_id, coalesce(v_selected, '{}'), v_is_correct, coalesce(v_selected, '{}'), v_is_correct)
    on conflict (attempt_id, question_id)
    do update set selected_option_ids = excluded.selected_option_ids,
                  is_correct = excluded.is_correct,
                  first_selected_option_ids = coalesce(public.activity_answers.first_selected_option_ids, excluded.selected_option_ids),
                  first_is_correct = coalesce(public.activity_answers.first_is_correct, excluded.is_correct);

    v_total_count := v_total_count + 1;
    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    if v_show_feedback then
      v_result := v_result || jsonb_build_object(
        'questionId', v_question_id,
        'isCorrect', v_is_correct,
        'correctOptionIds', v_correct_ids,
        'explanation', (select explanation from public.question_bank where id = v_question_id),
        'bibleReference', (select bible_reference from public.question_bank where id = v_question_id)
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

revoke execute on function public.start_activity_attempt(uuid) from public, anon;
revoke execute on function public.get_activity_questions_for_attempt(uuid) from public, anon;
revoke execute on function public.save_activity_answer(uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.check_activity_answer(uuid, uuid) from public, anon;
revoke execute on function public.get_activity_attempt_answers(uuid) from public, anon;
revoke execute on function public.submit_activity_attempt(uuid, jsonb) from public, anon;
grant execute on function public.start_activity_attempt(uuid) to authenticated;
grant execute on function public.get_activity_questions_for_attempt(uuid) to authenticated;
grant execute on function public.save_activity_answer(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.check_activity_answer(uuid, uuid) to authenticated;
grant execute on function public.get_activity_attempt_answers(uuid) to authenticated;
grant execute on function public.submit_activity_attempt(uuid, jsonb) to authenticated;

-- 7. Desafio prático: marcar "Pratiquei" e, se quiser, uma nota PRIVADA. Só o próprio aluno
--    enxerga a linha (nenhuma política para professor/coordenação/admin) e não há log de auditoria,
--    para o texto nunca ir parar em registro de terceiros.
create table if not exists public.challenge_completions (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  challenge_id uuid not null references public.practice_challenges (id) on delete cascade,
  practiced_at timestamptz not null default now(),
  private_note text check (private_note is null or length(private_note) <= 2000),
  primary key (enrollment_id, challenge_id)
);

alter table public.challenge_completions enable row level security;

create policy challenge_completions_own
  on public.challenge_completions for all to authenticated
  using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid()))
  with check (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid()));

revoke all on public.challenge_completions from anon;
grant select, insert, update, delete on public.challenge_completions to authenticated;
