-- Permite que familiares compartilhem o mesmo e-mail de contato mantendo
-- contas individuais: o aluno passa a logar por um código de acesso único
-- gerado pelo sistema (guardado aqui e em auth.users.phone — nunca em
-- auth.users.email, que o Supabase exige único), não mais por e-mail.
-- profiles.email continua existindo livremente repetido (sem unique),
-- só para contato — nunca mais usado como identidade de login do aluno.
alter table public.profiles
  add column access_code text unique;

-- handle_new_user precisa lidar com contas sem auth.users.email (o caso
-- novo de aluno por código de acesso): guarda o e-mail de CONTATO vindo de
-- user_metadata.contact_email (já que new.email vem nulo nesse caso), e só
-- tenta casar convite pendente por e-mail quando new.email de fato existe
-- — para conta por código de acesso, quem concede o papel e finaliza o
-- convite é o próprio acceptStudentInvitation, explicitamente, porque
-- e-mail repetido entre convites tornaria o casamento por e-mail ambíguo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  matched_invitation public.invitations%rowtype;
  contact_email text;
begin
  contact_email := coalesce(new.email, new.raw_user_meta_data ->> 'contact_email');

  insert into public.profiles (id, full_name, email, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(contact_email, ''), '@', 1)),
    contact_email,
    'active'
  )
  on conflict (id) do update set email = excluded.email;

  if new.email is not null then
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
  end if;

  return new;
end;
$function$;
