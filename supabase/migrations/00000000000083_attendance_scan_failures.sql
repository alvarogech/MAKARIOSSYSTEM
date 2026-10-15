-- Erros da chamada por QR: quando a pagina /presenca/[token] recusa (CPF sem
-- inscricao, volume errado, localizacao, falha do servidor...), o motivo fica
-- guardado aqui. Antes o aluno via a mensagem e ela sumia; a coordenacao so
-- sabia que "deu erro". Aparece junto do pedido de ajuda do aluno.
--
-- Nada de coordenada: so se a pagina conseguiu a localizacao ou nao. O CPF
-- fica so como hash (o mesmo de enrollment_requests.cpf_hash e help_requests).
-- Quem grava e o servidor (service_role).
create table if not exists public.attendance_scan_failures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  step text not null check (step in ('abrir', 'salvar')),
  code text not null check (char_length(code) <= 40),
  message text not null check (char_length(message) <= 300),
  qr_code_id uuid references public.attendance_qr_codes (id) on delete set null,
  cpf_hash text,
  enrollment_request_id uuid references public.enrollment_requests (id) on delete set null,
  student_id uuid references auth.users (id) on delete set null,
  had_location boolean not null default false,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);
create index if not exists attendance_scan_failures_cpf on public.attendance_scan_failures (cpf_hash, created_at desc);
create index if not exists attendance_scan_failures_request on public.attendance_scan_failures (enrollment_request_id, created_at desc);
create index if not exists attendance_scan_failures_created on public.attendance_scan_failures (created_at desc);

alter table public.attendance_scan_failures enable row level security;
drop policy if exists attendance_scan_failures_coordinator_admin_select on public.attendance_scan_failures;
create policy attendance_scan_failures_coordinator_admin_select
  on public.attendance_scan_failures for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
revoke all on public.attendance_scan_failures from anon;
revoke all on public.attendance_scan_failures from authenticated;
grant select on public.attendance_scan_failures to authenticated;
grant all on public.attendance_scan_failures to service_role;
