alter table public.profiles enable row level security;

-- Leitura: o próprio usuário sempre pode ler o próprio profile (mesmo se
-- suspenso — precisa ver por que está bloqueado); admin/coordenação podem
-- ler qualquer profile.
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy profiles_select_any_admin_coordinator
  on public.profiles
  for select
  to authenticated
  using (public.has_role('admin') or public.has_role('coordinator'));

-- Atualização: o próprio usuário só pode atualizar o próprio profile, e só
-- se estiver ativo (usuário suspenso não edita nem o próprio nome).
-- `status` só pode ser alterado por admin (ver policy dedicada abaixo) —
-- reforçado também na camada de aplicação, que nunca inclui `status` no
-- payload de "atualizar meus dados".
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and public.current_profile_is_active())
  with check (id = auth.uid());

create policy profiles_update_any_admin
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nenhuma policy de INSERT/DELETE para authenticated: profiles só nasce via
-- o trigger `handle_new_user` (SECURITY DEFINER, portanto ignora RLS) e
-- exclusões acadêmicas preferem arquivamento (status = suspended) a DELETE.
