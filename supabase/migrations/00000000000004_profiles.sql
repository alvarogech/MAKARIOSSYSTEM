-- Perfil acadêmico do usuário — 1:1 com auth.users, mas deliberadamente
-- separado dele (auth.users resolve identidade; profiles + user_roles
-- resolvem quem a pessoa é academicamente). Ver PLANO_TECNICO.md seção 10.

create type public.profile_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  birth_date date,
  photo_url text,
  status public.profile_status not null default 'active',
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Dados acadêmicos do usuário. NUNCA confundir com auth.users (identidade '
  'gerenciada pelo Supabase Auth) — profiles.status é o que a aplicação e '
  'as políticas de RLS consultam para saber se o acesso está suspenso.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
