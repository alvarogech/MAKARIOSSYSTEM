-- Solicitação de presença: o aluno pede que uma aula (ou várias) de um encontro que já aconteceu
-- conste como presente, com justificativa; o ADMINISTRADOR aprova ou recusa. Só aprovada conta
-- para a frequência (a pendente não conta).

create table if not exists public.attendance_requests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  enrollment_request_id uuid references public.enrollment_requests (id) on delete set null,
  lessons smallint[] not null check (cardinality(lessons) between 1 and 12),
  justification text not null check (char_length(justification) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  constraint attendance_requests_unique unique (meeting_id, student_id)
);

alter table public.attendance_requests enable row level security;

create policy attendance_requests_select_own on public.attendance_requests
  for select to authenticated using (student_id = auth.uid());
create policy attendance_requests_select_staff on public.attendance_requests
  for select to authenticated
  using (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug));
-- Decidir (aprovar/recusar/reabrir) é só do administrador.
create policy attendance_requests_write_admin on public.attendance_requests
  for all to authenticated
  using (public.has_role('admin'::public.role_slug))
  with check (public.has_role('admin'::public.role_slug));

revoke all on public.attendance_requests from anon;
grant select, insert, update, delete on public.attendance_requests to authenticated;
grant all on public.attendance_requests to service_role;

-- O aluno pede: confere matrícula na turma do encontro, encontro já iniciado, aulas válidas e justificativa.
create or replace function public.request_attendance(p_meeting_id uuid, p_lessons integer[], p_justification text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_class uuid;
  v_minutes integer;
  v_date date;
  v_start time;
  v_request uuid;
  v_lessons integer[];
  v_text text := btrim(coalesce(p_justification, ''));
begin
  if v_uid is null then
    raise exception 'Sessão expirada. Entre de novo.';
  end if;

  select cm.class_id, cm.academic_minutes, cm.meeting_date, cm.start_time
  into v_class, v_minutes, v_date, v_start
  from public.class_meetings cm where cm.id = p_meeting_id and cm.status <> 'canceled';
  if v_class is null then
    raise exception 'Encontro não encontrado.';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.class_id = v_class and e.student_id = v_uid and e.status in ('active', 'regularization', 'approved')
  ) then
    raise exception 'Você não é aluno da turma deste encontro.';
  end if;

  if v_date is null or (v_date > (now() at time zone 'America/Sao_Paulo')::date)
     or (v_date = (now() at time zone 'America/Sao_Paulo')::date and v_start > (now() at time zone 'America/Sao_Paulo')::time) then
    raise exception 'Só dá para solicitar presença de um encontro que já começou.';
  end if;

  if char_length(v_text) < 10 then
    raise exception 'Explique em pelo menos 10 caracteres por que a presença deve constar.';
  end if;
  if char_length(v_text) > 1000 then
    raise exception 'A justificativa pode ter até 1000 caracteres.';
  end if;

  select array(select distinct x from unnest(coalesce(p_lessons, '{}'::integer[])) x order by x) into v_lessons;
  if cardinality(v_lessons) = 0 then
    raise exception 'Marque pelo menos uma aula.';
  end if;
  if exists (select 1 from unnest(v_lessons) x where x < 1 or x > v_minutes / 60) then
    raise exception 'Aula inválida para este encontro.';
  end if;

  select r.id into v_request
  from public.enrollment_requests r
  join public.classes c on c.id = v_class
  join public.season_volume_offerings o on o.id = c.season_volume_offering_id
  join public.volumes v on v.id = o.volume_id
  where r.student_id = v_uid and r.status = 'approved' and r.season_id = o.season_id
    and (r.primary_volume_slug = v.slug or r.secondary_volume_slug = v.slug)
  order by r.created_at desc limit 1;

  insert into public.attendance_requests (meeting_id, student_id, enrollment_request_id, lessons, justification)
  values (p_meeting_id, v_uid, v_request, v_lessons::smallint[], v_text);
exception when unique_violation then
  raise exception 'Você já fez uma solicitação para este encontro.';
end;
$$;

revoke all on function public.request_attendance(uuid, integer[], text) from public, anon;
grant execute on function public.request_attendance(uuid, integer[], text) to authenticated;

-- O aluno pode desistir de um pedido que ainda está pendente.
create or replace function public.cancel_attendance_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.attendance_requests
  where id = p_request_id and student_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Solicitação não encontrada ou já decidida.';
  end if;
end;
$$;

revoke all on function public.cancel_attendance_request(uuid) from public, anon;
grant execute on function public.cancel_attendance_request(uuid) to authenticated;

-- Créditos de presença: passam a incluir as solicitações APROVADAS.
create or replace function public.attendance_credits(p_class_id uuid default null)
returns table (
  person_key text,
  meeting_id uuid,
  counts_for_meeting_id uuid,
  lessons integer[],
  minutes integer,
  source text,
  location_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_staff boolean := public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug);
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  with src as (
    select coalesce('r:' || s.enrollment_request_id::text, 's:' || s.student_id::text) as pk,
           s.meeting_id as mid,
           coalesce(s.makeup_for_meeting_id, s.meeting_id) as cfm,
           s.lesson_numbers::integer[] as les,
           s.recognized_minutes as mins,
           case when s.makeup_for_meeting_id is not null then 'reposicao' else 'qr' end as src,
           s.location_status as loc
    from public.attendance_scans s
    union all
    select coalesce('r:' || m.enrollment_request_id::text, 's:' || m.student_id::text),
           m.meeting_id,
           coalesce(m.makeup_for_meeting_id, m.meeting_id),
           m.lessons::integer[],
           cardinality(m.lessons) * 60,
           case when m.makeup_for_meeting_id is not null then 'reposicao' else 'manual' end,
           null::text
    from public.attendance_manual_entries m
    union all
    select coalesce('r:' || d.enrollment_request_id::text, 's:' || d.student_id::text),
           d.meeting_id,
           d.meeting_id,
           d.lessons::integer[],
           cardinality(d.lessons) * 60,
           'autodeclaracao',
           null::text
    from public.attendance_declarations d
    where d.status <> 'revoked' and cardinality(d.lessons) > 0
    union all
    select coalesce('r:' || q.enrollment_request_id::text, 's:' || q.student_id::text),
           q.meeting_id,
           q.meeting_id,
           q.lessons::integer[],
           cardinality(q.lessons) * 60,
           'solicitacao',
           null::text
    from public.attendance_requests q
    where q.status = 'approved'
  ),
  scope as (
    select
      (v_staff and p_class_id is null) as unrestricted,
      case
        when p_class_id is not null and (v_staff or public.is_teacher_assigned_to_class(p_class_id))
          then coalesce((select array_agg(r.person_key) from public.class_roster(p_class_id) r), '{}'::text[])
        else coalesce((
          select array_agg(k) from (
            select 'r:' || r.id::text as k from public.enrollment_requests r where r.student_id = v_uid and r.status = 'approved'
            union all select 's:' || v_uid::text
          ) own
        ), '{}'::text[])
      end as keys
  )
  select src.pk, src.mid, src.cfm, src.les, src.mins, src.src, src.loc
  from src, scope
  where scope.unrestricted or src.pk = any (scope.keys);
end;
$$;

revoke all on function public.attendance_credits(uuid) from public, anon;
grant execute on function public.attendance_credits(uuid) to authenticated;
