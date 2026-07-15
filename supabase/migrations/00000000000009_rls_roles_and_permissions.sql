-- Tabelas de catálogo: leitura liberada para qualquer usuário autenticado
-- (a UI precisa, por exemplo, listar nomes de perfil), escrita reservada a
-- migrations/service role — nenhuma policy de insert/update/delete é
-- criada de propósito (RLS nega por padrão o que não tem policy).

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy roles_select_authenticated
  on public.roles
  for select
  to authenticated
  using (true);

create policy permissions_select_authenticated
  on public.permissions
  for select
  to authenticated
  using (true);

create policy role_permissions_select_authenticated
  on public.role_permissions
  for select
  to authenticated
  using (true);
