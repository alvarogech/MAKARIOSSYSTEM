-- Retrofit: get_activity_questions_for_attempt (Fase 3) passa a devolver
-- também `selectionMode`, agora que question_bank.selection_mode existe
-- (migration 00000000000029) — sem isso, o exercício sempre renderizava
-- rádio, mesmo para questões "marque todas as corretas".
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
