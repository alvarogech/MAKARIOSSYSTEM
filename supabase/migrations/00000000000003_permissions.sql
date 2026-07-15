-- Catálogo de referência (resource, action) por perfil. Usado como
-- documentação viva e fonte de verdade para o que a camada de políticas
-- tipada em TypeScript (src/authorization) implementa — a decisão de
-- autorização em si roda em código/RLS, não como lookup dinâmico desta
-- tabela em cada requisição.

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint permissions_resource_action_unique unique (resource, action)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- Matriz mínima da Fase 1 (identidade, perfis, convites). Novas linhas serão
-- adicionadas nas fases seguintes conforme cada módulo acadêmico nascer.
insert into public.permissions (resource, action, description) values
  ('profile', 'read_own', 'Ver o próprio perfil'),
  ('profile', 'update_own', 'Atualizar dados pessoais permitidos do próprio perfil'),
  ('profile', 'read_any', 'Ver o perfil de qualquer usuário'),
  ('profile', 'suspend', 'Suspender ou reativar o acesso de um usuário'),
  ('user_roles', 'read_own', 'Ver os próprios perfis (roles) atribuídos'),
  ('user_roles', 'manage', 'Atribuir ou remover perfis (roles) de qualquer usuário'),
  ('invitations', 'create', 'Convidar um novo usuário'),
  ('invitations', 'read', 'Consultar convites enviados'),
  ('audit_logs', 'read', 'Consultar o log de auditoria');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
    ('student', 'profile', 'read_own'),
    ('student', 'profile', 'update_own'),
    ('student', 'user_roles', 'read_own'),

    ('teacher', 'profile', 'read_own'),
    ('teacher', 'profile', 'update_own'),
    ('teacher', 'user_roles', 'read_own'),

    ('content_editor', 'profile', 'read_own'),
    ('content_editor', 'profile', 'update_own'),
    ('content_editor', 'user_roles', 'read_own'),

    ('coordinator', 'profile', 'read_own'),
    ('coordinator', 'profile', 'update_own'),
    ('coordinator', 'profile', 'read_any'),
    ('coordinator', 'user_roles', 'read_own'),
    ('coordinator', 'invitations', 'create'),
    ('coordinator', 'invitations', 'read'),

    ('admin', 'profile', 'read_own'),
    ('admin', 'profile', 'update_own'),
    ('admin', 'profile', 'read_any'),
    ('admin', 'profile', 'suspend'),
    ('admin', 'user_roles', 'read_own'),
    ('admin', 'user_roles', 'manage'),
    ('admin', 'invitations', 'create'),
    ('admin', 'invitations', 'read'),
    ('admin', 'audit_logs', 'read')
  ) as matrix(role_slug, resource, action)
  join public.roles r on r.slug = matrix.role_slug::public.role_slug
  join public.permissions p
    on p.resource = matrix.resource and p.action = matrix.action;
