-- Adiciona e-mail ao profile (sincronizado de auth.users no momento da
-- criação) para permitir que coordenação/admin localizem um usuário por
-- e-mail ao designar professor ou matricular aluno — sem precisar do
-- client administrativo (que não deveria ser usado só para uma busca).
-- Continua protegido pelas mesmas policies de RLS de `profiles`
-- (self + coordenação/admin).

alter table public.profiles add column email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invitation public.invitations%rowtype;
begin
  insert into public.profiles (id, full_name, email, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'active'
  )
  on conflict (id) do update set email = excluded.email;

  select *
  into matched_invitation
  from public.invitations
  where email = new.email
    and status = 'pending'
  order by invited_at desc
  limit 1;

  if found then
    insert into public.user_roles (user_id, role_id)
    values (new.id, matched_invitation.intended_role_id)
    on conflict (user_id, role_id) do nothing;

    update public.invitations
    set status = 'accepted', accepted_at = now()
    where id = matched_invitation.id;
  end if;

  return new;
end;
$$;
