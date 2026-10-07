-- Fase 2 — higiene de dados.

-- 1. Dados de demonstração ficam marcados (flag), nunca apagados, e somem das listas e contagens.
alter table public.profiles add column if not exists is_demo boolean not null default false;

update public.profiles set is_demo = true
where lower(email) in ('aluno-demo@example.com', 'aluno.demo@makarios.local');

-- 2. "Trabalho em equipe" (Voz) era o único módulo sem aula: cria a aula "Apostila" vazia, como nos outros.
insert into public.lessons (module_id, name, order_index)
select m.id, 'Apostila', 1
from public.modules m
join public.volumes v on v.id = m.volume_id
where v.slug = 'voz' and m.name = 'Trabalho em equipe'
  and not exists (select 1 from public.lessons l where l.module_id = m.id);

-- 3. A lista da turma ignora contas de demonstração.
create or replace function public.class_roster(p_class_id uuid)
returns table (
  person_key text,
  request_id uuid,
  student_id uuid,
  enrollment_id uuid,
  full_name text,
  email text,
  phone text,
  cpf_last4 text,
  stage text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_staff boolean := public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug);
begin
  if not (v_staff or public.is_teacher_assigned_to_class(p_class_id)) then
    return;
  end if;

  return query
  with cls as (
    select c.id, o.season_id, o.volume_id, v.slug as vslug, t.slug as tslug
    from public.classes c
    join public.season_volume_offerings o on o.id = c.season_volume_offering_id
    join public.volumes v on v.id = o.volume_id
    join public.class_templates t on t.id = c.class_template_id
    where c.id = p_class_id
  ),
  enrolled as (
    select e.id as enrollment_id, e.student_id as sid
    from public.enrollments e
    where e.class_id = p_class_id and e.status in ('active', 'regularization', 'approved')
  ),
  enrolled_people as (
    select
      case when r.id is not null then 'r:' || r.id::text else 's:' || en.sid::text end as pk,
      r.id as rid, en.sid, en.enrollment_id,
      coalesce(r.full_name, p.full_name) as fname,
      coalesce(r.email, p.email) as femail,
      r.phone as fphone,
      r.cpf_last4 as fcpf,
      'matriculado'::text as fstage
    from enrolled en
    join public.profiles p on p.id = en.sid and not p.is_demo
    left join lateral (
      select r2.* from public.enrollment_requests r2, cls
      where r2.student_id = en.sid and r2.status = 'approved' and r2.season_id = cls.season_id
        and (r2.primary_volume_slug = cls.vslug or r2.secondary_volume_slug = cls.vslug)
      order by r2.created_at desc limit 1
    ) r on true
  ),
  waiting as (
    select 'r:' || r.id::text as pk, r.id as rid, r.student_id as sid, null::uuid as enrollment_id,
           r.full_name as fname, r.email as femail, r.phone as fphone, r.cpf_last4 as fcpf,
           'aguardando_acesso'::text as fstage
    from public.enrollment_requests r, cls
    where r.status = 'approved' and r.season_id = cls.season_id
      and ((r.primary_volume_slug = cls.vslug and r.primary_schedule_slug = cls.tslug)
        or (r.secondary_volume_slug = cls.vslug and r.secondary_schedule_slug = cls.tslug))
      and not exists (
        select 1 from public.enrollments e2
        join public.season_volume_offerings o2 on o2.id = e2.season_volume_offering_id
        where e2.student_id = r.student_id and o2.volume_id = cls.volume_id
          and e2.status in ('active', 'regularization', 'approved')
      )
  )
  select u.pk, u.rid, u.sid, u.enrollment_id, u.fname,
         case when v_staff then u.femail end,
         case when v_staff then u.fphone end,
         u.fcpf, u.fstage
  from (select * from enrolled_people union all select * from waiting) u
  order by u.fname;
end;
$$;

revoke all on function public.class_roster(uuid) from public, anon;
grant execute on function public.class_roster(uuid) to authenticated;

-- 4. Painel de qualidade dos dados (só coordenação/admin): tudo que pede uma decisão humana.
create or replace function public.data_quality_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug)) then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    -- Duas contas de aluno com o mesmo e-mail (a mesma pessoa duas vezes?).
    'duplicate_profiles', coalesce((
      select jsonb_agg(g order by g->>'email') from (
        select jsonb_build_object(
          'email', lower(p.email),
          'profiles', jsonb_agg(jsonb_build_object(
            'id', p.id,
            'name', p.full_name,
            'created_at', p.created_at,
            'last_sign_in_at', u.last_sign_in_at,
            'enrollments', (
              select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'status', e.status, 'class', c.name)), '[]'::jsonb)
              from public.enrollments e join public.classes c on c.id = e.class_id where e.student_id = p.id
            ),
            'linked_request', exists (select 1 from public.enrollment_requests rq where rq.student_id = p.id),
            'attendance_records', (select count(*) from public.attendance_scans s where s.student_id = p.id)
              + (select count(*) from public.attendance_scans s2 join public.enrollment_requests r on r.id = s2.enrollment_request_id where r.student_id = p.id)
          ) order by p.created_at)
        ) as g
        from public.profiles p
        left join auth.users u on u.id = p.id
        where p.email is not null and not p.is_demo
        group by lower(p.email)
        having count(*) > 1
      ) x
    ), '[]'::jsonb),
    -- Mesmo e-mail em inscrições de pessoas diferentes (família dividindo e-mail?).
    'shared_email_requests', coalesce((
      select jsonb_agg(jsonb_build_object('email', e, 'names', n) order by e) from (
        select lower(r.email) as e, jsonb_agg(distinct r.full_name) as n
        from public.enrollment_requests r
        where r.status in ('approved', 'pending')
        group by lower(r.email)
        having count(distinct r.cpf_hash) > 1
      ) y
    ), '[]'::jsonb),
    -- Convite de professor ainda pendente com o WhatsApp de um professor que já está ativo.
    'duplicate_teacher_invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'name', i.intended_full_name, 'phone', i.phone, 'same_as', p.full_name))
      from public.invitations i
      join public.profiles p on right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(i.phone, ''), '\D', '', 'g'), 10)
        and length(regexp_replace(coalesce(i.phone, ''), '\D', '', 'g')) >= 10
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id and r.slug::text = 'teacher'
      where i.purpose = 'teacher_onboarding' and i.consumed_at is null and i.revoked_at is null
    ), '[]'::jsonb),
    -- Professores sem WhatsApp completo (DDD + 9 + 8 dígitos).
    'teacher_phones', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone) order by p.full_name)
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id and r.slug::text = 'teacher'
      where not (regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') ~ '^(55)?[0-9]{2}9[0-9]{8}$')
    ), '[]'::jsonb),
    'demo_profiles', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email) order by p.email)
      from public.profiles p where p.is_demo
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.data_quality_report() from public, anon;
grant execute on function public.data_quality_report() to authenticated;
