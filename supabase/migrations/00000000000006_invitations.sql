-- Trilha própria da aplicação sobre convites, complementando o convite
-- nativo do Supabase Auth (supabase.auth.admin.inviteUserByEmail) com o
-- contexto acadêmico: qual perfil o convite pretende atribuir ao aceitar.

create type public.invitation_status as enum (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  intended_role_id uuid not null references public.roles (id) on delete restrict,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references auth.users (id) on delete restrict,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

comment on table public.invitations is
  'Registro do convite acadêmico (qual perfil será atribuído). A entrega '
  'do e-mail em si e a criação de senha são responsabilidade do Supabase Auth.';

create index invitations_email_status_idx on public.invitations (email, status);
