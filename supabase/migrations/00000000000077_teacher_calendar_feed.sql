-- Feed de calendário (.ics) por professor, assinável pelo Google Calendar/iPhone e sempre atualizado.
-- O link carrega um token secreto de 256 bits; o banco guarda só o hash (sha256). Revogável: apagar/gerar outro.
-- Reversão: ver bloco DOWN no fim.

create table if not exists public.teacher_calendar_tokens (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.teacher_calendar_tokens enable row level security;

create policy teacher_calendar_tokens_select_own on public.teacher_calendar_tokens
  for select to authenticated using (teacher_id = auth.uid());
create policy teacher_calendar_tokens_insert_own on public.teacher_calendar_tokens
  for insert to authenticated with check (teacher_id = auth.uid() and public.has_role('teacher'));
create policy teacher_calendar_tokens_update_own on public.teacher_calendar_tokens
  for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy teacher_calendar_tokens_delete_own on public.teacher_calendar_tokens
  for delete to authenticated using (teacher_id = auth.uid());

-- As aulas de quem tem o token. Chamável sem login (o próprio token é a credencial); só devolve
-- horário, tema, turma e local — nunca material, gabarito, alunos ou notas.
create or replace function public.calendar_feed_lessons(p_token text)
returns table (
  block_id uuid,
  meeting_date date,
  start_time time,
  end_time time,
  module_name text,
  volume_name text,
  class_name text,
  location_text text,
  room text,
  block_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    m.meeting_date,
    coalesce(b.start_time, m.start_time),
    coalesce(b.end_time, m.end_time),
    mo.name,
    v.name,
    c.name,
    coalesce(
      case when l.id is not null then l.name || coalesce(' — ' || l.address, '') end,
      m.location,
      c.location
    ),
    coalesce(b.room, m.room),
    b.status::text
  from public.teacher_calendar_tokens t
  join public.class_meeting_blocks b on b.teacher_id = t.teacher_id and b.status <> 'canceled'
  join public.class_meetings m on m.id = b.class_meeting_id and m.status <> 'canceled'
  join public.classes c on c.id = m.class_id
  join public.season_volume_offerings o on o.id = c.season_volume_offering_id
  join public.volumes v on v.id = o.volume_id
  left join public.modules mo on mo.id = b.module_id
  left join public.locations l on l.id = coalesce(m.location_id, c.location_id)
  where t.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
    and m.meeting_date is not null
    and coalesce(b.start_time, m.start_time) is not null
    and coalesce(b.end_time, m.end_time) is not null
  order by m.meeting_date, coalesce(b.start_time, m.start_time);
$$;

revoke all on function public.calendar_feed_lessons(text) from public;
grant execute on function public.calendar_feed_lessons(text) to anon, authenticated;

-- DOWN (manual):
--   drop function public.calendar_feed_lessons(text);
--   drop table public.teacher_calendar_tokens;
