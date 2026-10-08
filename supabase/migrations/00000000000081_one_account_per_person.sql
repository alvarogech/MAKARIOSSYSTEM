-- Uma pessoa = uma conta (rede de segurança no banco; o app já checa antes de criar a conta).
-- Causa do problema: a MESMA inscrição recebeu dois convites de primeiro acesso e os dois criaram conta.
-- E-mail dividido com familiar de NOME DIFERENTE continua permitido (código de acesso).
-- Reversão: drop trigger profiles_one_account_per_person on public.profiles; drop trigger invitations_one_account_per_request on public.invitations;
--           drop function private.guard_one_account_per_person(), private.guard_one_account_per_request(), private.normalize_person_name(text);

create or replace function private.normalize_person_name(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(p, ''))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g');
$$;

-- 1) Não pode haver duas contas com o mesmo e-mail E o mesmo nome.
create or replace function private.guard_one_account_per_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or btrim(new.email) = '' or new.is_demo then
    return new;
  end if;
  if private.normalize_person_name(new.full_name) = '' then
    return new;
  end if;
  if exists (
    select 1 from public.profiles o
    where o.id <> new.id
      and not o.is_demo
      and lower(btrim(o.email)) = lower(btrim(new.email))
      and private.normalize_person_name(o.full_name) = private.normalize_person_name(new.full_name)
  ) then
    raise exception 'Já existe uma conta com este e-mail e este nome — uma pessoa tem uma conta só.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_one_account_per_person on public.profiles;
create trigger profiles_one_account_per_person
  before insert or update of email, full_name on public.profiles
  for each row execute function private.guard_one_account_per_person();

-- 2) Uma inscrição só pode ser aceita uma vez (um convite de primeiro acesso consumido por inscrição).
create or replace function private.guard_one_account_per_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.purpose = 'student_onboarding'
     and new.enrollment_request_id is not null
     and new.consumed_at is not null
     and old.consumed_at is null
     and exists (
       select 1 from public.invitations o
       where o.id <> new.id
         and o.purpose = 'student_onboarding'
         and o.enrollment_request_id = new.enrollment_request_id
         and o.consumed_at is not null
     ) then
    raise exception 'Esta inscrição já foi aceita por outro convite.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists invitations_one_account_per_request on public.invitations;
create trigger invitations_one_account_per_request
  before update of consumed_at on public.invitations
  for each row execute function private.guard_one_account_per_request();

revoke all on function private.normalize_person_name(text) from public, anon, authenticated;
revoke all on function private.guard_one_account_per_person() from public, anon, authenticated;
revoke all on function private.guard_one_account_per_request() from public, anon, authenticated;
