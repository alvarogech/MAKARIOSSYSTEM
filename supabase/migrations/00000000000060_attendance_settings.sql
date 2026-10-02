-- Chave "Exigir localizacao" da chamada por QR (Coordenacao > Presenca por
-- QR Code). Ligada (padrao): sem localizacao ou longe do local, nao
-- registra. Desligada: registra sempre, marcando "sem localizacao" ou
-- "longe do local" para a coordenacao conferir. Existe para o dia em que
-- muitos alunos chegam sem a localizacao liberada no celular.
create table if not exists public.attendance_settings (
  id boolean primary key default true check (id),
  require_location boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.attendance_settings (id) values (true) on conflict (id) do nothing;

alter table public.attendance_settings enable row level security;
drop policy if exists attendance_settings_coordinator_admin on public.attendance_settings;
create policy attendance_settings_coordinator_admin
  on public.attendance_settings for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
revoke all on public.attendance_settings from anon;
grant select, update on public.attendance_settings to authenticated;
grant all on public.attendance_settings to service_role;

alter table public.attendance_scans drop constraint if exists attendance_scans_location_status_check;
alter table public.attendance_scans add constraint attendance_scans_location_status_check
  check (location_status in ('dentro', 'impreciso', 'sem_local_cadastrado', 'sem_localizacao', 'longe'));
