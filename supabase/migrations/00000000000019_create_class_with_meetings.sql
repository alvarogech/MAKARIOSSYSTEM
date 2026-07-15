-- Operação crítica multi-tabela: criar uma turma já com todos os seus
-- encontros gerados a partir do modelo de horário, numa única transação
-- (evita uma turma "órfã" sem encontros se a segunda escrita falhar).
--
-- SECURITY INVOKER de propósito (não DEFINER): quem chama continua sujeito
-- às mesmas políticas de RLS de `classes`/`class_meetings` — esta função
-- só organiza a transação, não eleva privilégio de ninguém.
create or replace function public.create_class_with_meetings(
  p_season_volume_offering_id uuid,
  p_class_template_id uuid,
  p_name text,
  p_location text default null,
  p_capacity integer default null
)
returns public.classes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template public.class_templates%rowtype;
  v_class public.classes%rowtype;
  v_seq integer;
begin
  select * into v_template from public.class_templates where id = p_class_template_id;

  if v_template.id is null then
    raise exception 'Modelo de turma % não encontrado.', p_class_template_id;
  end if;

  insert into public.classes (
    season_volume_offering_id, class_template_id, name, location, capacity
  ) values (
    p_season_volume_offering_id, p_class_template_id, p_name, p_location, p_capacity
  )
  returning * into v_class;

  for v_seq in 1..v_template.meetings_count loop
    insert into public.class_meetings (
      class_id, sequence, academic_minutes, start_time, end_time, break_minutes
    ) values (
      v_class.id, v_seq, v_template.academic_minutes_per_meeting,
      v_template.start_time, v_template.end_time, v_template.break_minutes
    );
  end loop;

  return v_class;
end;
$$;

comment on function public.create_class_with_meetings(uuid, uuid, text, text, integer) is
  'Cria uma turma e já gera todos os encontros do modelo de horário, numa '
  'única transação. SECURITY INVOKER — continua sujeito à RLS de quem chama.';
