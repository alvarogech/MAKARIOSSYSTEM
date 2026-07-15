alter table public.user_roles enable row level security;

-- Leitura: o próprio usuário vê os próprios perfis atribuídos; admin vê de
-- todo mundo (necessário para telas administrativas e para a troca de
-- perfil funcionar sem expor dado de outros usuários).
create policy user_roles_select_own
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_roles_select_any_admin
  on public.user_roles
  for select
  to authenticated
  using (public.is_admin());

-- Escrita: atribuir/remover perfil é ação administrativa — nunca o próprio
-- usuário, nem coordenação (que não tem "gerenciar perfis e permissões" na
-- matriz da seção 3 do PLANO_TECNICO.md).
create policy user_roles_insert_admin
  on public.user_roles
  for insert
  to authenticated
  with check (public.is_admin());

create policy user_roles_delete_admin
  on public.user_roles
  for delete
  to authenticated
  using (public.is_admin());
