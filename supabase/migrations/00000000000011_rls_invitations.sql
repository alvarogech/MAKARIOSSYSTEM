alter table public.invitations enable row level security;

-- Convites são visíveis e criáveis apenas por quem pode convidar
-- (admin/coordenação) — nunca públicos, nunca visíveis para o convidado
-- (que só interage com o e-mail/link do Supabase Auth, não com esta tabela).
create policy invitations_select_admin_coordinator
  on public.invitations
  for select
  to authenticated
  using (public.has_role('admin') or public.has_role('coordinator'));

create policy invitations_insert_admin_coordinator
  on public.invitations
  for insert
  to authenticated
  with check (
    (public.has_role('admin') or public.has_role('coordinator'))
    and invited_by = auth.uid()
  );

create policy invitations_update_admin_coordinator
  on public.invitations
  for update
  to authenticated
  using (public.has_role('admin') or public.has_role('coordinator'))
  with check (public.has_role('admin') or public.has_role('coordinator'));
