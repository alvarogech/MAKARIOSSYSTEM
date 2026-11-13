-- Liberacao da prova depois do prazo, para UM aluno, por 24 horas.
--
-- Decisao do pastor Alvaro em 13/11/2026: quem nao conseguiu fazer a avaliacao
-- procura a coordenacao, e a coordenacao libera no sistema por um dia.
--
-- O que muda:
--   1. Tabela assessment_late_releases (uma liberacao por avaliacao e matricula,
--      renovavel), com RLS e auditoria, no molde de assessment_exceptional_grants.
--   2. start_assessment_attempt: copia INTEIRA da definicao da migracao 032, e a
--      UNICA mudanca e a regra do prazo. Prazo vencido so barra quando nao existe
--      liberacao da matricula com valid_until > now(). A conferencia foi para
--      depois de achar a matricula. Limite de tentativas, tempo de 60 minutos e
--      todo o resto ficam iguais: a liberacao NAO da tentativa extra.
--
-- Arquivo so com ASCII (mensagens com acento usam E'\uXXXX'), idempotente, e
-- pode ser colado no SQL Editor do Supabase. Rodar duas vezes nao quebra.

create table if not exists public.assessment_late_releases (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  valid_until timestamptz not null,
  granted_by uuid not null references auth.users (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) >= 10),
  created_at timestamptz not null default now(),
  constraint assessment_late_releases_unique unique (assessment_id, enrollment_id)
);

drop trigger if exists assessment_late_releases_audit on public.assessment_late_releases;
create trigger assessment_late_releases_audit
  after insert or update or delete on public.assessment_late_releases
  for each row execute function private.log_audit_event();

alter table public.assessment_late_releases enable row level security;

grant select, insert, update on public.assessment_late_releases to authenticated;

drop policy if exists assessment_late_releases_select_own on public.assessment_late_releases;
create policy assessment_late_releases_select_own
  on public.assessment_late_releases for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

drop policy if exists assessment_late_releases_select_staff on public.assessment_late_releases;
create policy assessment_late_releases_select_staff
  on public.assessment_late_releases for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

drop policy if exists assessment_late_releases_insert_staff on public.assessment_late_releases;
create policy assessment_late_releases_insert_staff
  on public.assessment_late_releases for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and granted_by = auth.uid()
  );

-- Renovar uma liberacao e um update: quem renova passa a constar em granted_by.
drop policy if exists assessment_late_releases_update_staff on public.assessment_late_releases;
create policy assessment_late_releases_update_staff
  on public.assessment_late_releases for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and granted_by = auth.uid()
  );

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
    raise exception E'Avalia\u00e7\u00e3o n\u00e3o encontrada.';
  end if;

  if v_assessment.status <> 'open' then
    raise exception E'Esta avalia\u00e7\u00e3o n\u00e3o est\u00e1 aberta.';
  end if;

  if v_assessment.opens_at is not null and now() < v_assessment.opens_at then
    raise exception E'Esta avalia\u00e7\u00e3o ainda n\u00e3o abriu.';
  end if;

  select id into v_enrollment_id
  from public.enrollments
  where student_id = auth.uid()
    and season_volume_offering_id = v_assessment.season_volume_offering_id
    and status in ('active', 'regularization', 'approved')
  limit 1;

  if v_enrollment_id is null then
    raise exception E'Voc\u00ea n\u00e3o tem matr\u00edcula ativa nesta oferta de volume.';
  end if;

  -- Prazo vencido so barra quando NAO ha liberacao valida desta matricula
  -- (assessment_late_releases). A conferencia fica depois de achar a matricula,
  -- porque a liberacao e por matricula.
  if v_assessment.closes_at is not null and now() > v_assessment.closes_at
     and not exists (
       select 1 from public.assessment_late_releases r
       where r.assessment_id = p_assessment_id
         and r.enrollment_id = v_enrollment_id
         and r.valid_until > now()
     ) then
    raise exception E'O prazo desta avalia\u00e7\u00e3o j\u00e1 encerrou.';
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
    raise exception E'Voc\u00ea j\u00e1 usou todas as tentativas dispon\u00edveis para esta avalia\u00e7\u00e3o.';
  end if;

  if v_assessment.type = 'recovery' and not public.is_recovery_path_completed(p_assessment_id, v_enrollment_id) then
    raise exception E'Conclua a trilha de revis\u00e3o obrigat\u00f3ria antes de tentar a recupera\u00e7\u00e3o.';
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
