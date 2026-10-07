-- Fonte única de "quem é aluno de cada turma" e de "quanta presença cada um tem".
--
-- Até aqui a tela de presença contava pelas INSCRIÇÕES aprovadas (277), enquanto a área do
-- professor contava pelas MATRÍCULAS (75, só quem já criou a conta) — por isso os números
-- divergiam. A matrícula exige conta (enrollments.student_id), então não dá para criá-la
-- na aprovação; em vez disso, a lista da turma une as duas coisas:
--   matriculado          = tem matrícula ativa na turma;
--   aguardando_acesso    = inscrição aprovada para a turma, ainda sem conta/matrícula.
-- A matrícula continua nascendo quando a pessoa cria a conta (convite).

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
    join public.profiles p on p.id = en.sid
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

-- Créditos de presença, no mesmo formato para todo mundo (a REGRA de frequência fica em um
-- único código TypeScript, testado; isto só entrega os dados que cada perfil pode ver):
--   coordenação/admin: tudo (ou só a turma pedida);
--   professor: só a turma a que está atribuído;
--   aluno: só as próprias presenças.
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
  ),
  scope as (
    -- unrestricted: coordenação/admin sem turma pedida (vê tudo). Nos demais casos, só as chaves
    -- (pessoas) da turma — roster vazio = nenhuma chave — ou, para o aluno, as próprias.
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
