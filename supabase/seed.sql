-- Seed de desenvolvimento — dados 100% fictícios, nunca reais.
--
-- Cria um usuário de teste por perfil (mais um caso multi-perfil e um caso
-- suspenso) diretamente em auth.users/auth.identities, seguindo o padrão
-- documentado pela comunidade Supabase para seed local (GoTrue aceita
-- senha já hasheada via pgcrypto). Roda apenas contra `supabase start`
-- local — NUNCA execute este arquivo contra um projeto remoto/produção.
--
-- ATENÇÃO (pendência declarada em FASE_1_RELATORIO.md): este script foi
-- escrito seguindo o formato documentado das colunas de auth.users, mas
-- não pôde ser executado nem validado neste ambiente (sem Docker/Supabase
-- CLI disponíveis na sessão que o gerou). Rode `supabase db reset` como
-- primeiro passo ao configurar o ambiente local e ajuste esta seed se
-- alguma coluna não corresponder à versão do GoTrue instalada.
--
-- Senha de todas as contas de teste: "Makarios#2026"

do $$
declare
  v_password text := crypt('Makarios#2026', gen_salt('bf'));
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';

  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_coordinator_id uuid := '22222222-2222-2222-2222-222222222222';
  v_teacher_id uuid := '33333333-3333-3333-3333-333333333333';
  v_student_id uuid := '44444444-4444-4444-4444-444444444444';
  v_editor_id uuid := '55555555-5555-5555-5555-555555555555';
  v_multi_role_id uuid := '66666666-6666-6666-6666-666666666666';
  v_suspended_id uuid := '77777777-7777-7777-7777-777777777777';

  v_user record;
begin
  for v_user in
    select * from (values
      (v_admin_id, 'admin.teste@makarios.local', 'Administrador de Teste'),
      (v_coordinator_id, 'coordenacao.teste@makarios.local', 'Coordenação de Teste'),
      (v_teacher_id, 'professor.teste@makarios.local', 'Professor de Teste'),
      (v_student_id, 'aluno.teste@makarios.local', 'Aluno de Teste'),
      (v_editor_id, 'editor.teste@makarios.local', 'Editor de Conteúdo de Teste'),
      (v_multi_role_id, 'aluno.professor.teste@makarios.local', 'Aluno e Professor de Teste'),
      (v_suspended_id, 'suspenso.teste@makarios.local', 'Usuário Suspenso de Teste')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) values (
      v_instance_id, v_user.id, 'authenticated', 'authenticated', v_user.email, v_password,
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_user.full_name),
      false, now(), now()
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user.id, v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end loop;

  -- profiles é criado automaticamente pelo trigger handle_new_user, mas o
  -- seed insere diretamente em auth.users (sem passar pela API), então o
  -- trigger AFTER INSERT ainda dispara normalmente — nada extra a fazer
  -- aqui além de marcar o usuário de teste "suspenso" como tal.
  update public.profiles set status = 'suspended' where id = v_suspended_id;

  insert into public.user_roles (user_id, role_id)
  select v_admin_id, id from public.roles where slug = 'admin'
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select v_coordinator_id, id from public.roles where slug = 'coordinator'
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select v_teacher_id, id from public.roles where slug = 'teacher'
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select v_student_id, id from public.roles where slug = 'student'
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select v_editor_id, id from public.roles where slug = 'content_editor'
  on conflict do nothing;

  -- Caso multi-perfil: usado para testar seleção/troca de perfil ativo.
  insert into public.user_roles (user_id, role_id)
  select v_multi_role_id, id from public.roles where slug = 'student'
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select v_multi_role_id, id from public.roles where slug = 'teacher'
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select v_suspended_id, id from public.roles where slug = 'student'
  on conflict do nothing;

  -- Convite pendente fictício, aguardando primeiro acesso.
  insert into public.invitations (email, intended_role_id, status, invited_by)
  select 'convidado.teste@makarios.local', id, 'pending', v_admin_id
  from public.roles where slug = 'student'
  on conflict do nothing;
end $$;
