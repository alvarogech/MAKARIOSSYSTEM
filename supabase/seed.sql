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

-- =============================================================================
-- Fase 2 — Administração acadêmica: temporada 2026.2, volumes, modelos de
-- horário (doc 08 §4/§5), ofertas, turmas e encontros de demonstração.
-- Nenhuma data real de encontro é inventada (meeting_date fica nulo) —
-- ver doc 08 §14 ("não inventar datas exatas dos encontros").
-- =============================================================================

do $$
declare
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_teacher_id uuid := '33333333-3333-3333-3333-333333333333';
  v_student_id uuid := '44444444-4444-4444-4444-444444444444';
  v_multi_role_id uuid := '66666666-6666-6666-6666-666666666666';

  v_season_id uuid;
  v_essencia_id uuid;
  v_caminho_id uuid;
  v_voz_id uuid;
  v_terca_quinta_template_id uuid;
  v_sabado_template_id uuid;
  v_essencia_offering_id uuid;
  v_caminho_offering_id uuid;
  v_class_tq_id uuid;
  v_class_sab_id uuid;
  v_class_caminho_tq_id uuid;
  v_seq int;
begin
  -- Temporada 2026.2 (doc 08 §1: período presencial outubro de 2026).
  insert into public.seasons (name, status)
  values ('2026.2', 'open')
  on conflict (name) do nothing;

  select id into v_season_id from public.seasons where name = '2026.2';

  -- Volumes fixos (doc 01 §4).
  insert into public.volumes (slug, name, order_index, presencial_hours)
  values
    ('essencia', 'Essência', 1, 16),
    ('caminho', 'Caminho', 2, 16),
    ('voz', 'Voz', 3, 16)
  on conflict (slug) do nothing;

  select id into v_essencia_id from public.volumes where slug = 'essencia';
  select id into v_caminho_id from public.volumes where slug = 'caminho';
  select id into v_voz_id from public.volumes where slug = 'voz';

  -- Sequência padrão de pré-requisitos: Essência → Caminho → Voz (doc 02 §2).
  insert into public.volume_prerequisites (volume_id, prerequisite_volume_id)
  values
    (v_caminho_id, v_essencia_id),
    (v_voz_id, v_caminho_id)
  on conflict do nothing;

  -- Modelos de horário — valores exatos do doc 08 §4/§5.
  insert into public.class_templates (
    slug, name, weekdays, start_time, end_time, break_minutes,
    meetings_count, academic_minutes_per_meeting, total_academic_minutes
  ) values (
    'terca_quinta', 'Terça e quinta', array['tuesday', 'thursday'],
    '19:30', '21:50', 20,
    8, 120, 960
  )
  on conflict (slug) do nothing;

  insert into public.class_templates (
    slug, name, weekdays, start_time, end_time, break_minutes,
    meetings_count, academic_minutes_per_meeting, total_academic_minutes
  ) values (
    'sabado', 'Sábado', array['saturday'],
    '08:00', '12:30', 30,
    4, 240, 960
  )
  on conflict (slug) do nothing;

  select id into v_terca_quinta_template_id from public.class_templates where slug = 'terca_quinta';
  select id into v_sabado_template_id from public.class_templates where slug = 'sabado';

  -- Ofertas de volume na 2026.2 — uma por volume (critério de aceitação da Fase 2).
  insert into public.season_volume_offerings (season_id, volume_id, status)
  values
    (v_season_id, v_essencia_id, 'open'),
    (v_season_id, v_caminho_id, 'open'),
    (v_season_id, v_voz_id, 'draft')
  on conflict (season_id, volume_id) do nothing;

  select id into v_essencia_offering_id
  from public.season_volume_offerings where season_id = v_season_id and volume_id = v_essencia_id;
  select id into v_caminho_offering_id
  from public.season_volume_offerings where season_id = v_season_id and volume_id = v_caminho_id;

  -- Uma turma terça/quinta e uma turma sábado, ambas de Essência
  -- (critério de aceitação da Fase 2). Local fictício — nunca um endereço
  -- real. `classes` não tem unique constraint em
  -- (season_volume_offering_id, class_template_id) — a idempotência do
  -- seed vem de checar existência antes de inserir, não de ON CONFLICT.
  select id into v_class_tq_id from public.classes
  where season_volume_offering_id = v_essencia_offering_id
    and class_template_id = v_terca_quinta_template_id;

  if v_class_tq_id is null then
    insert into public.classes (season_volume_offering_id, class_template_id, name, location, status)
    values (v_essencia_offering_id, v_terca_quinta_template_id, 'Essência — Turma A (terça/quinta)', 'Sala fictícia 1', 'open')
    returning id into v_class_tq_id;
  end if;

  select id into v_class_sab_id from public.classes
  where season_volume_offering_id = v_essencia_offering_id
    and class_template_id = v_sabado_template_id;

  if v_class_sab_id is null then
    insert into public.classes (season_volume_offering_id, class_template_id, name, location, status)
    values (v_essencia_offering_id, v_sabado_template_id, 'Essência — Turma B (sábado)', 'Sala fictícia 2', 'open')
    returning id into v_class_sab_id;
  end if;

  -- Encontros gerados a partir do template — sem data real (meeting_date nulo).
  if not exists (select 1 from public.class_meetings where class_id = v_class_tq_id) then
    for v_seq in 1..8 loop
      insert into public.class_meetings (class_id, sequence, academic_minutes, start_time, end_time, break_minutes)
      values (v_class_tq_id, v_seq, 120, '19:30', '21:50', 20);
    end loop;
  end if;

  if not exists (select 1 from public.class_meetings where class_id = v_class_sab_id) then
    for v_seq in 1..4 loop
      insert into public.class_meetings (class_id, sequence, academic_minutes, start_time, end_time, break_minutes)
      values (v_class_sab_id, v_seq, 240, '08:00', '12:30', 30);
    end loop;
  end if;

  -- Turma de Caminho (terça/quinta), só para a matrícula simultânea de
  -- demonstração abaixo poder apontar para uma turma da oferta certa.
  select id into v_class_caminho_tq_id from public.classes
  where season_volume_offering_id = v_caminho_offering_id
    and class_template_id = v_terca_quinta_template_id;

  if v_class_caminho_tq_id is null then
    insert into public.classes (season_volume_offering_id, class_template_id, name, location, status)
    values (v_caminho_offering_id, v_terca_quinta_template_id, 'Caminho — Turma A (terça/quinta)', 'Sala fictícia 1', 'open')
    returning id into v_class_caminho_tq_id;
  end if;

  if not exists (select 1 from public.class_meetings where class_id = v_class_caminho_tq_id) then
    for v_seq in 1..8 loop
      insert into public.class_meetings (class_id, sequence, academic_minutes, start_time, end_time, break_minutes)
      values (v_class_caminho_tq_id, v_seq, 120, '19:30', '21:50', 20);
    end loop;
  end if;

  -- Professor de teste atribuído à turma terça/quinta de Essência.
  insert into public.teacher_assignments (teacher_id, class_id, function)
  values (v_teacher_id, v_class_tq_id, 'regente')
  on conflict do nothing;

  -- Matrícula de demonstração: o aluno de teste na turma terça/quinta de
  -- Essência, e o usuário multi-perfil matriculado em DOIS volumes ao
  -- mesmo tempo (Essência + Caminho) — prova viva do critério "matrícula
  -- simultânea em mais de um volume".
  insert into public.enrollments (student_id, season_volume_offering_id, class_id, authorized_by)
  values (v_student_id, v_essencia_offering_id, v_class_tq_id, v_admin_id)
  on conflict (student_id, season_volume_offering_id) do nothing;

  insert into public.enrollments (student_id, season_volume_offering_id, class_id, authorized_by)
  values (v_multi_role_id, v_essencia_offering_id, v_class_tq_id, v_admin_id)
  on conflict (student_id, season_volume_offering_id) do nothing;

  insert into public.enrollments (student_id, season_volume_offering_id, class_id, authorized_by)
  values (v_multi_role_id, v_caminho_offering_id, v_class_caminho_tq_id, v_admin_id)
  on conflict (student_id, season_volume_offering_id) do nothing;
end $$;
