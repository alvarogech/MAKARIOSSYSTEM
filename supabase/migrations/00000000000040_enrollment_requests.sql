-- Solicitações públicas de inscrição. O envio deste formulário não cria
-- usuário, matrícula ou exceção de pré-requisito; a coordenação analisa a
-- solicitação antes de executar qualquer uma dessas operações.

create table public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  season_id uuid not null references public.seasons (id) on delete restrict,
  full_name text not null,
  cpf_encrypted text not null,
  cpf_hash text not null,
  cpf_last4 text not null,
  email text not null,
  phone text not null,
  primary_volume_slug text not null
    check (primary_volume_slug in ('essencia', 'caminho', 'voz')),
  primary_schedule_slug text not null
    check (primary_schedule_slug in ('terca_quinta', 'sabado')),
  wants_second_volume boolean not null default false,
  secondary_volume_slug text
    check (secondary_volume_slug is null or secondary_volume_slug in ('essencia', 'caminho', 'voz')),
  secondary_schedule_slug text
    check (secondary_schedule_slug is null or secondary_schedule_slug in ('terca_quinta', 'sabado')),
  prerequisite_declaration text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  privacy_terms_version text not null,
  consent_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollment_requests_second_volume_consistent check (
    (
      wants_second_volume
      and secondary_volume_slug is not null
      and secondary_schedule_slug is not null
      and secondary_volume_slug <> primary_volume_slug
      and secondary_schedule_slug <> primary_schedule_slug
    )
    or (
      not wants_second_volume
      and secondary_volume_slug is null
      and secondary_schedule_slug is null
    )
  )
);

create unique index enrollment_requests_active_cpf_unique
  on public.enrollment_requests (season_id, cpf_hash)
  where status in ('pending', 'approved');

create index enrollment_requests_status_created_idx
  on public.enrollment_requests (status, created_at desc);

create trigger enrollment_requests_set_updated_at
  before update on public.enrollment_requests
  for each row execute function public.set_updated_at();

alter table public.enrollment_requests enable row level security;

-- Não existe policy de INSERT para anon/authenticated: a página pública
-- valida, cifra e grava exclusivamente por uma Server Action isolada.
create policy enrollment_requests_select_coordinator_admin
  on public.enrollment_requests for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy enrollment_requests_update_coordinator_admin
  on public.enrollment_requests for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

revoke insert, delete on public.enrollment_requests from anon, authenticated;

comment on table public.enrollment_requests is
  'Solicitações públicas para análise. Não equivalem a usuário, matrícula '
  'ou exceção de pré-requisito.';

