-- Convites de onboarding (aluno e professor) concedem o papel de forma
-- explícita no código da aplicação. O trigger casava convite só por e-mail
-- (o mais recente pendente) — quando a mesma pessoa tinha um convite de
-- aluno E um de professor, ele pegava o errado: Davi Dunck ficou só com o
-- papel "aluno" e sem o de professor. O trigger agora só cuida dos
-- convites legados (que não são de onboarding).
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
      and coalesce(purpose, '') not in ('student_onboarding', 'teacher_onboarding', 'password_reset')
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
