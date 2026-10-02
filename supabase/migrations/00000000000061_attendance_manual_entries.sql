-- Presenca lancada a mao pela coordenacao (lista de papel), para quem nao
-- conseguiu escanear o QR. Guarda as AULAS do encontro em que a pessoa
-- esteve (1 a 4 na terca/quinta, 1 a 8 no sabado), o que cobre tanto quem
-- chegou atrasado quanto quem saiu mais cedo.
create table if not exists public.attendance_manual_entries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  enrollment_request_id uuid references public.enrollment_requests (id) on delete cascade,
  student_id uuid references auth.users (id) on delete cascade,
  lessons smallint[] not null check (cardinality(lessons) between 1 and 12),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint attendance_manual_entries_has_person check (enrollment_request_id is not null or student_id is not null)
);
create unique index if not exists attendance_manual_entries_request_unique
  on public.attendance_manual_entries (enrollment_request_id, meeting_id) where enrollment_request_id is not null;
create unique index if not exists attendance_manual_entries_student_unique
  on public.attendance_manual_entries (student_id, meeting_id) where enrollment_request_id is null;

alter table public.attendance_manual_entries enable row level security;
drop policy if exists attendance_manual_entries_coordinator_admin on public.attendance_manual_entries;
create policy attendance_manual_entries_coordinator_admin
  on public.attendance_manual_entries for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
revoke all on public.attendance_manual_entries from anon;
grant select, insert, update, delete on public.attendance_manual_entries to authenticated;
grant all on public.attendance_manual_entries to service_role;
