-- Catálogo de perfis (roles). Sempre globais — nunca carregam class_id,
-- volume_id ou qualquer outro escopo (PLANO_TECNICO.md, seção 3/8).
-- O vínculo de professor com turma específica pertence exclusivamente a
-- `teacher_assignments`, que só existirá a partir da Fase 2 (depende de
-- `classes`, fora do escopo acadêmico da Fase 1).

create type public.role_slug as enum (
  'student',
  'teacher',
  'coordinator',
  'admin',
  'content_editor'
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  slug public.role_slug not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.roles is
  'Catálogo de perfis do sistema. Uma linha por perfil possível — nunca por vínculo.';

insert into public.roles (slug, name, description) values
  ('student', 'Aluno', 'Acessa matrículas próprias, conteúdo liberado e atividades.'),
  ('teacher', 'Professor', 'Acessa turmas atribuídas via teacher_assignments (Fase 2).'),
  ('coordinator', 'Coordenação', 'Gestão acadêmica completa da Escola Makários.'),
  ('admin', 'Administrador', 'Acesso administrativo total, incluindo perfis e permissões.'),
  ('content_editor', 'Editor de conteúdo', 'Cria e edita módulos, aulas e avaliações.');
