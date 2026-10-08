-- Qualidade dos dados: resolver as pendências na própria página.
-- Exclusões só pelo administrador e só quando seguras (travas abaixo); tudo fica na trilha de auditoria.
-- Reversão: drop das funções public.delete_enrollment_request / duplicate_account_blocker / audit_admin_action,
-- das funções private.* abaixo e do trigger enrollment_requests_audit_delete; restaurar data_quality_report da migração 071.

-- Por que uma inscrição NÃO pode ser excluída (null = pode).
create or replace function private.enrollment_request_delete_blocker(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.enrollment_requests%rowtype;
begin
  select * into r from public.enrollment_requests where id = p_id;
  if r.id is null then
    return 'Inscrição não encontrada.';
  end if;

  -- Presença ligada a esta inscrição seria apagada junto (cascata): nesse caso, cancele em vez de excluir.
  if exists (select 1 from public.attendance_scans s where s.enrollment_request_id = r.id)
     or exists (select 1 from public.attendance_manual_entries m where m.enrollment_request_id = r.id) then
    return 'Tem presença registrada — cancele a inscrição em vez de excluir.';
  end if;

  if exists (select 1 from public.invitations i where i.enrollment_request_id = r.id and i.consumed_at is not null) then
    return 'A pessoa já criou a conta por esta inscrição.';
  end if;

  -- Se a pessoa tem matrícula ativa, só dá para excluir esta inscrição se houver outra (duplicada) da mesma pessoa.
  if r.student_id is not null
     and exists (select 1 from public.enrollments e where e.student_id = r.student_id and e.status <> 'canceled')
     and not exists (
       select 1 from public.enrollment_requests o
       where o.id <> r.id and o.cpf_hash = r.cpf_hash and o.season_id = r.season_id and o.status <> 'cancelled'
     ) then
    return 'A pessoa tem matrícula ativa e esta é a única inscrição dela — cancele a matrícula antes.';
  end if;

  return null;
end;
$$;

-- Por que uma conta duplicada NÃO pode ser excluída (null = pode). Exige que exista outra conta "boa" com o mesmo e-mail.
create or replace function private.duplicate_account_blocker(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  p public.profiles%rowtype;
  v_last timestamptz;
begin
  select * into p from public.profiles where id = p_id;
  if p.id is null then
    return 'Conta não encontrada.';
  end if;
  if p.email is null or not exists (
    select 1 from public.profiles o where lower(o.email) = lower(p.email) and o.id <> p.id and not o.is_demo
  ) then
    return 'Não há outra conta com este e-mail — esta não é duplicada.';
  end if;

  -- A outra conta precisa ter algo a preservar (matrícula ou inscrição ligada).
  if not exists (
    select 1 from public.profiles o
    where lower(o.email) = lower(p.email) and o.id <> p.id and not o.is_demo
      and (
        exists (select 1 from public.enrollments e where e.student_id = o.id and e.status <> 'canceled')
        or exists (select 1 from public.enrollment_requests rq where rq.student_id = o.id)
      )
  ) then
    return 'A outra conta ainda não tem matrícula nem inscrição — não é seguro excluir esta.';
  end if;

  select u.last_sign_in_at into v_last from auth.users u where u.id = p.id;
  if v_last is not null then
    return 'Esta conta já foi usada (tem acesso registrado).';
  end if;

  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p.id and r.slug::text <> 'student'
  ) then
    return 'Esta conta tem outro papel além de aluno.';
  end if;

  if exists (select 1 from public.enrollment_requests rq where rq.student_id = p.id) then
    return 'Esta conta está ligada a uma inscrição.';
  end if;
  if exists (select 1 from public.enrollments e where e.student_id = p.id and e.status <> 'canceled') then
    return 'Esta conta tem matrícula ativa — cancele a matrícula primeiro.';
  end if;
  if exists (select 1 from public.attendance_scans s where s.student_id = p.id)
     or exists (select 1 from public.attendance_manual_entries m where m.student_id = p.id)
     or exists (select 1 from public.attendance_declarations d where d.student_id = p.id)
     or exists (select 1 from public.attendance_requests a where a.student_id = p.id) then
    return 'Esta conta tem presença registrada.';
  end if;

  return null;
end;
$$;

revoke all on function private.enrollment_request_delete_blocker(uuid) from public, anon, authenticated;
revoke all on function private.duplicate_account_blocker(uuid) from public, anon, authenticated;

-- Exclui uma inscrição (só admin; só se a trava liberar). Convites ainda não usados dessa inscrição saem junto.
create or replace function public.delete_enrollment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block text;
begin
  if not public.has_role('admin'::public.role_slug) then
    raise exception 'Apenas o administrador pode excluir inscrições.';
  end if;
  v_block := private.enrollment_request_delete_blocker(p_id);
  if v_block is not null then
    raise exception '%', v_block;
  end if;
  delete from public.invitations where enrollment_request_id = p_id and consumed_at is null;
  delete from public.enrollment_requests where id = p_id;
end;
$$;

-- A exclusão de inscrição passa a ficar na trilha de auditoria (a edição já ficava).
drop trigger if exists enrollment_requests_audit_delete on public.enrollment_requests;
create trigger enrollment_requests_audit_delete
  after delete on public.enrollment_requests
  for each row execute function private.log_audit_event();

create or replace function public.duplicate_account_blocker(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role('admin'::public.role_slug) then
    raise exception 'Apenas o administrador pode excluir contas.';
  end if;
  return private.duplicate_account_blocker(p_profile_id);
end;
$$;

-- Registro de ações do administrador feitas fora de tabelas com gatilho de auditoria (ex.: troca de e-mail de login, exclusão de conta).
create or replace function public.audit_admin_action(p_action text, p_entity text, p_entity_id text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.has_role('admin'::public.role_slug) then
    raise exception 'Apenas o administrador.';
  end if;
  insert into private.audit_logs (actor_id, action, entity, entity_id, old_value, justification)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_detail, 'Página Qualidade dos dados');
end;
$$;

revoke all on function public.delete_enrollment_request(uuid) from public, anon;
revoke all on function public.duplicate_account_blocker(uuid) from public, anon;
revoke all on function public.audit_admin_action(text, text, text, jsonb) from public, anon;
grant execute on function public.delete_enrollment_request(uuid) to authenticated;
grant execute on function public.duplicate_account_blocker(uuid) to authenticated;
grant execute on function public.audit_admin_action(text, text, text, jsonb) to authenticated;

-- Relatório enriquecido: ids e travas para cada ação possível na página.
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
              + (select count(*) from public.attendance_scans s2 join public.enrollment_requests r on r.id = s2.enrollment_request_id where r.student_id = p.id),
            'delete_blocker', private.duplicate_account_blocker(p.id)
          ) order by p.created_at)
        ) as g
        from public.profiles p
        left join auth.users u on u.id = p.id
        where p.email is not null and not p.is_demo
        group by lower(p.email)
        having count(*) > 1
      ) x
    ), '[]'::jsonb),
    'shared_email_requests', coalesce((
      select jsonb_agg(jsonb_build_object('email', e, 'names', n, 'requests', rq) order by e) from (
        select lower(r.email) as e,
               jsonb_agg(distinct r.full_name) as n,
               jsonb_agg(jsonb_build_object(
                 'id', r.id,
                 'name', r.full_name,
                 'status', r.status,
                 'created_at', r.created_at,
                 'volume', r.primary_volume_slug,
                 'delete_blocker', private.enrollment_request_delete_blocker(r.id)
               ) order by r.created_at) as rq
        from public.enrollment_requests r
        where r.status in ('approved', 'pending')
        group by lower(r.email)
        having count(distinct r.cpf_hash) > 1
      ) y
    ), '[]'::jsonb),
    'duplicate_teacher_invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'name', i.intended_full_name, 'phone', i.phone,
        'same_as', p.full_name, 'same_as_id', p.id, 'same_as_email', p.email))
      from public.invitations i
      join public.profiles p on right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(i.phone, ''), '\D', '', 'g'), 10)
        and length(regexp_replace(coalesce(i.phone, ''), '\D', '', 'g')) >= 10
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id and r.slug::text = 'teacher'
      where i.purpose = 'teacher_onboarding' and i.consumed_at is null and i.revoked_at is null
    ), '[]'::jsonb),
    'teacher_phones', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone, 'email', p.email) order by p.full_name)
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
