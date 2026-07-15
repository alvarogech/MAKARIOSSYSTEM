-- user_roles é SEMPRE global: apenas (user_id, role_id). Nunca adicionar
-- class_id, volume_id ou qualquer coluna de escopo aqui — o vínculo de
-- professor com turma pertence exclusivamente a `teacher_assignments`
-- (Fase 2). Ver PLANO_TECNICO.md seção 4 e 8 ("evitar duas fontes de
-- verdade para o vínculo do professor").

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint user_roles_user_role_unique unique (user_id, role_id)
);

comment on table public.user_roles is
  'Perfis globais de um usuário. Nunca carrega escopo (turma/volume) — '
  'ver teacher_assignments (Fase 2) para o vínculo de professor.';

create index user_roles_user_id_idx on public.user_roles (user_id);
