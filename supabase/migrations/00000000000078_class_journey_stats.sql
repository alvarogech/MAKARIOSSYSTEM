-- Jornada da turma (professor e coordenação): só AGREGADOS — contagens por matéria e questões com dúvida recorrente.
-- Nunca devolve nome ou identificação de aluno, resposta individual, nota privada ou gabarito.
-- Dúvida recorrente só aparece com pelo menos 5 alunos que responderam (evita expor indivíduos).
-- Reversão: drop function public.class_journey_stats(uuid);

create or replace function public.class_journey_stats(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_volume uuid;
  v_students integer;
  v_modules jsonb;
  v_doubts jsonb;
begin
  if not (
    public.has_role('coordinator') or public.has_role('admin') or public.is_teacher_assigned_to_class(p_class_id)
  ) then
    raise exception 'Sem permissão para ver a jornada desta turma.';
  end if;

  select o.volume_id into v_volume
  from public.classes c
  join public.season_volume_offerings o on o.id = c.season_volume_offering_id
  where c.id = p_class_id;

  select count(*) into v_students
  from public.enrollments e
  where e.class_id = p_class_id and e.status in ('active', 'regularization', 'approved');

  with enr as (
    select id from public.enrollments
    where class_id = p_class_id and status in ('active', 'regularization', 'approved')
  ),
  mods as (
    select m.id, m.name, m.order_index from public.modules m where m.volume_id = v_volume
  ),
  acts as (
    select a.id, a.status, l.module_id
    from public.activities a
    join public.lessons l on l.id = a.lesson_id
    where l.module_id in (select id from mods)
  ),
  chs as (
    select c.id, c.status, l.module_id
    from public.practice_challenges c
    join public.lessons l on l.id = c.lesson_id
    where l.module_id in (select id from mods)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'module_id', mods.id,
    'name', mods.name,
    'activities_published', (select count(*) from acts where acts.module_id = mods.id and acts.status = 'published'),
    'activities_pending', (select count(*) from acts where acts.module_id = mods.id and acts.status <> 'published'),
    'challenges_published', (select count(*) from chs where chs.module_id = mods.id and chs.status = 'published'),
    'challenges_pending', (select count(*) from chs where chs.module_id = mods.id and chs.status <> 'published'),
    'students_done_activity', (
      select count(distinct t.enrollment_id)
      from public.activity_attempts t
      join acts on acts.id = t.activity_id
      where acts.module_id = mods.id and acts.status = 'published' and t.status = 'submitted'
        and t.enrollment_id in (select id from enr)
    ),
    'students_done_practice', (
      select count(distinct cc.enrollment_id)
      from public.challenge_completions cc
      join chs on chs.id = cc.challenge_id
      where chs.module_id = mods.id and chs.status = 'published'
        and cc.enrollment_id in (select id from enr)
    )
  ) order by mods.order_index), '[]'::jsonb)
  into v_modules
  from mods;

  with enr as (
    select id from public.enrollments
    where class_id = p_class_id and status in ('active', 'regularization', 'approved')
  ),
  per_question as (
    select
      aa.question_id,
      count(distinct t.enrollment_id) as answered,
      count(distinct t.enrollment_id) filter (where coalesce(aa.first_is_correct, aa.is_correct) is false) as wrong
    from public.activity_answers aa
    join public.activity_attempts t on t.id = aa.attempt_id
    where t.status = 'submitted'
      and t.enrollment_id in (select id from enr)
    group by aa.question_id
  )
  select coalesce(jsonb_agg(row_to_json(d)::jsonb order by d.wrong_share desc, d.answered desc), '[]'::jsonb)
  into v_doubts
  from (
    select
      pq.question_id,
      qb.prompt,
      m.name as module_name,
      pq.answered,
      pq.wrong,
      round(pq.wrong::numeric / pq.answered, 2) as wrong_share
    from per_question pq
    join public.question_bank qb on qb.id = pq.question_id
    join public.activity_questions aq on aq.question_id = pq.question_id
    join public.activities a on a.id = aq.activity_id and a.status = 'published'
    join public.lessons l on l.id = a.lesson_id
    join public.modules m on m.id = l.module_id and m.volume_id = v_volume
    where pq.answered >= 5
      and pq.wrong::numeric / pq.answered >= 0.4
    order by wrong_share desc, pq.answered desc
    limit 5
  ) d;

  return jsonb_build_object('students', v_students, 'modules', v_modules, 'doubts', v_doubts);
end;
$$;

revoke all on function public.class_journey_stats(uuid) from public;
grant execute on function public.class_journey_stats(uuid) to authenticated;
