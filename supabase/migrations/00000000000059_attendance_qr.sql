-- Chamada por QR Code: o aluno escaneia na entrada de cada bloco do
-- encontro (antes da aula e na volta do intervalo) e o sistema guarda o
-- horario exato. Ver src/modules/attendance/rules.ts para a regra de
-- quais aulas cada escaneamento reconhece.
--
-- O escaneamento fica ligado a INSCRICAO (enrollment_requests), e nao a
-- matricula: na abertura da temporada 2026.2 quase nenhum aluno tinha
-- conta/matricula ainda, e a presenca nao pode se perder por isso. Quem ja
-- tem conta e nao veio de inscricao publica fica ligado por student_id.
--
-- Escrita so pelo servidor (service_role, depois de validar QR, horario,
-- localizacao e identidade). Leitura so coordenacao/admin.

-- 1. Coordenadas dos locais, para a checagem de localizacao.
alter table public.locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists attendance_radius_meters integer not null default 200;

alter table public.locations drop constraint if exists locations_coordinates_pair;
alter table public.locations add constraint locations_coordinates_pair check (
  (latitude is null) = (longitude is null)
  and (latitude is null or latitude between -90 and 90)
  and (longitude is null or longitude between -180 and 180)
  and attendance_radius_meters between 20 and 5000
);

-- 2. Um QR por volume por semana (segunda a domingo, horario de Sao Paulo).
--    Trocar toda semana faz a foto da semana anterior parar de funcionar.
create table if not exists public.attendance_qr_codes (
  id uuid primary key default gen_random_uuid(),
  volume_id uuid not null references public.volumes (id) on delete cascade,
  week_start date not null,
  token text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint attendance_qr_codes_volume_week_unique unique (volume_id, week_start),
  constraint attendance_qr_codes_week_starts_monday check (extract(isodow from week_start) = 1),
  constraint attendance_qr_codes_token_length check (length(token) >= 16)
);

-- 3. Cada escaneamento valido. O primeiro de cada bloco vale; os seguintes
--    sao ignorados pelo servidor (indices unicos abaixo).
create table if not exists public.attendance_scans (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  qr_code_id uuid not null references public.attendance_qr_codes (id) on delete cascade,
  enrollment_request_id uuid references public.enrollment_requests (id) on delete cascade,
  student_id uuid references auth.users (id) on delete cascade,
  block smallint not null check (block in (1, 2)),
  scanned_at timestamptz not null default now(),
  lessons_total smallint not null check (lessons_total between 1 and 12),
  lessons_credited smallint not null,
  recognized_minutes integer not null check (recognized_minutes >= 0),
  identified_by text not null check (identified_by in ('login', 'cpf', 'aparelho')),
  location_status text not null check (location_status in ('dentro', 'impreciso', 'sem_local_cadastrado')),
  -- Reposicao: escaneou num encontro de outra turma do mesmo volume. Vale
  -- na hora (decisao da coordenacao em 02/10/2026), apontando para o
  -- encontro da turma do aluno que este conteudo cobre.
  makeup_for_meeting_id uuid references public.class_meetings (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint attendance_scans_has_person check (enrollment_request_id is not null or student_id is not null),
  constraint attendance_scans_credited_range check (lessons_credited between 0 and lessons_total)
);

create unique index if not exists attendance_scans_request_block_unique
  on public.attendance_scans (enrollment_request_id, meeting_id, block)
  where enrollment_request_id is not null;

create unique index if not exists attendance_scans_student_block_unique
  on public.attendance_scans (student_id, meeting_id, block)
  where enrollment_request_id is null;

create index if not exists attendance_scans_meeting_idx on public.attendance_scans (meeting_id);

-- 4. RLS: negar tudo por padrao; coordenacao/admin leem e geram QR.
alter table public.attendance_qr_codes enable row level security;
alter table public.attendance_scans enable row level security;

drop policy if exists attendance_qr_codes_coordinator_admin on public.attendance_qr_codes;
create policy attendance_qr_codes_coordinator_admin
  on public.attendance_qr_codes for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

drop policy if exists attendance_scans_select_coordinator_admin on public.attendance_scans;
create policy attendance_scans_select_coordinator_admin
  on public.attendance_scans for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

revoke all on public.attendance_qr_codes, public.attendance_scans from anon;
grant select, insert, update, delete on public.attendance_qr_codes to authenticated;
grant select on public.attendance_scans to authenticated;
grant all on public.attendance_qr_codes, public.attendance_scans to service_role;
