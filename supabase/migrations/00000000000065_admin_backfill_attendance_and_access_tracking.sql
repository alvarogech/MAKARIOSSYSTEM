-- 1. Presença lançada depois (à mão): só o ADMINISTRADOR escreve; a coordenação
--    continua enxergando. Inclui reposição (assistiu em outra turma do volume).
drop policy if exists attendance_manual_entries_coordinator_admin on public.attendance_manual_entries;

create policy attendance_manual_entries_select_coordinator_admin
  on public.attendance_manual_entries for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy attendance_manual_entries_write_admin
  on public.attendance_manual_entries for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

alter table public.attendance_manual_entries
  add column if not exists makeup_for_meeting_id uuid references public.class_meetings (id) on delete set null;

-- 2. Quais materiais cada aluno abriu (um registro por aluno+material). Antes disto
--    não havia nenhum registro de abertura: a contagem começa quando este código entra no ar.
create table if not exists public.content_access (
  student_id uuid not null references auth.users (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  opens_count integer not null default 1,
  primary key (student_id, content_id)
);

alter table public.content_access enable row level security;
create policy content_access_select_coordinator_admin
  on public.content_access for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
revoke all on public.content_access from anon;
grant select on public.content_access to authenticated;
grant all on public.content_access to service_role;

create or replace function public.record_content_open(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  -- Só registra quem realmente tem acesso ao material (aluno com matrícula no volume).
  if not exists (
    select 1 from public.contents c
    where c.id = p_content_id
      and public.has_active_enrollment_in_volume(c.volume_id)
  ) then
    return;
  end if;
  insert into public.content_access (student_id, content_id)
  values (auth.uid(), p_content_id)
  on conflict (student_id, content_id)
  do update set last_opened_at = now(), opens_count = public.content_access.opens_count + 1;
end;
$$;
revoke all on function public.record_content_open(uuid) from public, anon;
grant execute on function public.record_content_open(uuid) to authenticated;

-- 3. Painel de acesso dos alunos (coordenação/admin): conta criada, último login e materiais abertos.
create or replace function public.coordination_student_access()
returns table (
  request_id uuid,
  person_key text,
  full_name text,
  email text,
  phone text,
  volume_slug text,
  schedule_slug text,
  student_id uuid,
  last_sign_in_at timestamptz,
  materials_opened integer,
  last_material_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    r.id,
    coalesce(r.student_id::text, r.cpf_hash, r.id::text),
    r.full_name,
    r.email,
    r.phone,
    r.primary_volume_slug,
    r.primary_schedule_slug,
    r.student_id,
    u.last_sign_in_at,
    coalesce(a.n, 0)::integer,
    a.last_at
  from public.enrollment_requests r
  left join auth.users u on u.id = r.student_id
  left join (
    select ca.student_id, count(*) as n, max(ca.last_opened_at) as last_at
    from public.content_access ca
    group by ca.student_id
  ) a on a.student_id = r.student_id
  where r.status = 'approved'
    and (public.has_role('coordinator') or public.has_role('admin'));
$$;
revoke all on function public.coordination_student_access() from public, anon;
grant execute on function public.coordination_student_access() to authenticated;
