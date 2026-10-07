-- Autodeclaração de presença (para falhas técnicas na chamada): a coordenação abre uma
-- JANELA para um encontro específico; o aluno matriculado na turma desse encontro diz se
-- esteve e em quais aulas. Conta para a frequência como "Autodeclarada" e a coordenação
-- pode validar ou revogar em lote. Não sobrescreve QR/manual: as aulas se somam sem dobrar.

create table if not exists public.attendance_declaration_windows (
  meeting_id uuid primary key references public.class_meetings (id) on delete cascade,
  closes_at timestamptz not null,
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_declarations (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  enrollment_request_id uuid references public.enrollment_requests (id) on delete set null,
  -- Vazio = o aluno declarou que NÃO esteve.
  lessons smallint[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'validated', 'revoked')),
  declared_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  constraint attendance_declarations_unique unique (meeting_id, student_id)
);

alter table public.attendance_declaration_windows enable row level security;
alter table public.attendance_declarations enable row level security;

-- Janelas: qualquer usuário logado lê (não tem dado sensível); só coordenação/admin gerem.
create policy attendance_declaration_windows_read on public.attendance_declaration_windows
  for select to authenticated using (true);
create policy attendance_declaration_windows_write on public.attendance_declaration_windows
  for all to authenticated
  using (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug))
  with check (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug));

-- Declarações: o aluno lê as próprias; coordenação/admin leem e revisam. Criar só pela função abaixo.
create policy attendance_declarations_select_own on public.attendance_declarations
  for select to authenticated using (student_id = auth.uid());
create policy attendance_declarations_staff on public.attendance_declarations
  for all to authenticated
  using (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug))
  with check (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug));

revoke all on public.attendance_declaration_windows, public.attendance_declarations from anon;
grant select, insert, update, delete on public.attendance_declaration_windows, public.attendance_declarations to authenticated;
grant all on public.attendance_declaration_windows, public.attendance_declarations to service_role;

-- O aluno declara: confere matrícula na turma do encontro, janela aberta, uma resposta só e aulas válidas.
create or replace function public.declare_attendance(p_meeting_id uuid, p_lessons integer[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_class uuid;
  v_minutes integer;
  v_closes timestamptz;
  v_request uuid;
  v_lessons integer[];
begin
  if v_uid is null then
    raise exception 'Sessão expirada. Entre de novo.';
  end if;

  select cm.class_id, cm.academic_minutes into v_class, v_minutes from public.class_meetings cm where cm.id = p_meeting_id;
  if v_class is null then
    raise exception 'Encontro não encontrado.';
  end if;

  select w.closes_at into v_closes from public.attendance_declaration_windows w where w.meeting_id = p_meeting_id and w.enabled;
  if v_closes is null or now() > v_closes then
    raise exception 'A autodeclaração deste encontro não está aberta.';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.class_id = v_class and e.student_id = v_uid and e.status in ('active', 'regularization', 'approved')
  ) then
    raise exception 'Você não é aluno da turma deste encontro.';
  end if;

  select array(select distinct x from unnest(coalesce(p_lessons, '{}'::integer[])) x order by x) into v_lessons;
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

  insert into public.attendance_declarations (meeting_id, student_id, enrollment_request_id, lessons)
  values (p_meeting_id, v_uid, v_request, v_lessons::smallint[]);
exception when unique_violation then
  raise exception 'Você já respondeu sobre este encontro.';
end;
$$;

revoke all on function public.declare_attendance(uuid, integer[]) from public, anon;
grant execute on function public.declare_attendance(uuid, integer[]) to authenticated;

-- Créditos de presença: passam a incluir as autodeclarações (pendentes e validadas; revogadas não contam).
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

-- Janela de 1.4: Encontro 1 das turmas de SÁBADO (03/10/2026), aberta até 17/10/2026 (fim do dia, Brasília).
insert into public.attendance_declaration_windows (meeting_id, closes_at)
select m.id, timestamptz '2026-10-17 23:59:59-03'
from public.class_meetings m
join public.classes c on c.id = m.class_id
join public.class_templates t on t.id = c.class_template_id
where t.slug = 'sabado' and m.meeting_date = '2026-10-03' and m.sequence = 1
on conflict (meeting_id) do nothing;
