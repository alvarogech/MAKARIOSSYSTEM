-- Funções auxiliares usadas pelas políticas de RLS (para evitar recursão e
-- centralizar a lógica de "esta pessoa tem este perfil / está ativa?") e o
-- gatilho que liga auth.users -> profiles -> user_roles no primeiro acesso.

-- SECURITY DEFINER: roda com o privilégio do dono da função (ignora RLS de
-- quem chama), o que evita o problema clássico de uma policy em
-- `public.user_roles` precisar consultar `public.user_roles` para decidir
-- se libera a própria leitura. `search_path` é fixado por segurança.

create or replace function public.has_role(check_role public.role_slug)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.slug = check_role
  );
$$;

comment on function public.has_role(public.role_slug) is
  'Verdadeiro se o usuário autenticado possui o perfil informado (global, '
  'sem checar escopo/vínculo — escopo é responsabilidade de outra camada).';

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role('admin');
$$;

create or replace function public.current_profile_is_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.current_profile_is_active() is
  'Verdadeiro se o profile do usuário autenticado existe e está com '
  'status = active. Usado nas policies para bloquear usuário suspenso '
  'mesmo que a sessão de autenticação ainda esteja tecnicamente válida.';

-- Contexto de auditoria: permite que uma Server Action/RPC registre uma
-- justificativa textual para a operação corrente, lida pelo trigger de
-- auditoria (private.log_audit_event). Vale só para a transação atual
-- (equivalente a SET LOCAL) — por isso precisa ser chamada na mesma
-- transação da escrita que se quer justificar, dentro de uma função RPC.
create or replace function public.set_audit_justification(p_justification text)
returns void
language plpgsql
security invoker
as $$
begin
  perform set_config('app.justification', p_justification, true);
end;
$$;

-- Cria o profile automaticamente quando o Supabase Auth cria um usuário
-- (convite aceito / primeiro acesso), e — se houver um convite pendente
-- para o mesmo e-mail — atribui o perfil (role) pretendido e marca o
-- convite como aceito. Tudo em uma única transação implícita do INSERT em
-- auth.users que disparou o gatilho.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invitation public.invitations%rowtype;
begin
  insert into public.profiles (id, full_name, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'active'
  )
  on conflict (id) do nothing;

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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
