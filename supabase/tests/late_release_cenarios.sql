-- Cenarios da liberacao fora do prazo (migracao 087). Falha (ASSERT) se algo regredir.
-- Roda num Postgres LOCAL e descartavel, NUNCA em producao:
--   createdb liberacao_teste
--   psql -v ON_ERROR_STOP=1 -d liberacao_teste -f supabase/tests/late_release_stub.sql
--   (carregar a funcao start_assessment_attempt da migracao 032 renomeada para start_assessment_attempt_orig, opcional)
--   psql -v ON_ERROR_STOP=1 -d liberacao_teste -f supabase/migrations/00000000000087_assessment_late_releases.sql
--   psql -v ON_ERROR_STOP=1 -d liberacao_teste -f supabase/tests/late_release_cenarios.sql
-- Saida esperada: "CENARIOS OK".
set client_min_messages = warning;
truncate public.assessments, public.enrollments, public.assessment_attempts, public.assessment_exceptional_grants, public.assessment_late_releases cascade;
delete from auth.users;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000a3'),('00000000-0000-0000-0000-0000000000c1');

do $$
declare
  o uuid := gen_random_uuid();
  a_past uuid := gen_random_uuid(); a_future uuid := gen_random_uuid();
  s1 uuid := '00000000-0000-0000-0000-0000000000a1'; s2 uuid := '00000000-0000-0000-0000-0000000000a2'; s3 uuid := '00000000-0000-0000-0000-0000000000a3';
  coord uuid := '00000000-0000-0000-0000-0000000000c1';
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid();
  r public.assessment_attempts;
  msg text;
begin
  insert into public.assessments(id,status,closes_at,season_volume_offering_id) values (a_past,'open',now()-interval '2 hours',o),(a_future,'open',now()+interval '2 hours',o);
  insert into public.enrollments(id,student_id,season_volume_offering_id,status) values (e1,s1,o,'active'),(e2,s2,o,'active');
  perform set_config('app.uid', s1::text, false);

  -- 1 dentro do prazo, nada muda
  r := public.start_assessment_attempt(a_future);
  assert r.attempt_kind = 'regular', '1 dentro do prazo deveria iniciar';

  -- 2 prazo vencido sem liberacao barra
  begin perform public.start_assessment_attempt(a_past); assert false, '2 iniciou sem liberacao';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like 'O prazo desta avalia%encerrou.', '2 mensagem errada: ' || msg;
  end;

  -- 3 liberacao valida inicia, com 60 minutos a partir de agora
  insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_past,e1,now()+interval '24 hours',coord,'Aluno procurou a coordenacao');
  r := public.start_assessment_attempt(a_past);
  assert r.attempt_kind = 'regular', '3 deveria iniciar';
  assert round(extract(epoch from (r.deadline_at - now()))/60) = 60, '3 duracao deveria ser 60 minutos';
  assert (public.start_assessment_attempt(a_past)).id = r.id, '3b retomada deveria devolver a mesma tentativa';

  -- 4 liberacao vencida barra; renovar volta a valer
  insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_past,e2,now()-interval '1 minute',coord,'Liberacao antiga ja vencida');
  perform set_config('app.uid', s2::text, false);
  begin perform public.start_assessment_attempt(a_past); assert false, '4 iniciou com liberacao vencida';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like 'O prazo desta avalia%encerrou.', '4 mensagem errada: ' || msg;
  end;
  update public.assessment_late_releases set valid_until = now()+interval '24 hours' where enrollment_id = e2;
  r := public.start_assessment_attempt(a_past);
  assert r.attempt_kind = 'regular', '4b renovada deveria iniciar';

  -- 5 a liberacao NAO aumenta o numero de tentativas
  update public.assessment_attempts set status = 'submitted' where id = r.id;
  begin perform public.start_assessment_attempt(a_past); assert false, '5 deu tentativa extra';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like '%todas as tentativas%', '5 mensagem errada: ' || msg;
  end;

  -- 6 com tentativa excepcional: 2 no total, e a terceira barra
  insert into public.assessment_exceptional_grants values (a_past, e2);
  r := public.start_assessment_attempt(a_past);
  assert r.attempt_kind = 'exceptional', '6 segunda tentativa deveria ser excepcional';
  update public.assessment_attempts set status = 'submitted' where id = r.id;
  begin perform public.start_assessment_attempt(a_past); assert false, '6 terceira tentativa iniciou';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like '%todas as tentativas%', '6 mensagem errada: ' || msg;
  end;

  -- 7 sem matricula
  perform set_config('app.uid', s3::text, false);
  begin perform public.start_assessment_attempt(a_past); assert false, '7 iniciou sem matricula';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like '%matr%cula ativa%', '7 mensagem errada: ' || msg;
  end;

  -- 8 auditoria e unicidade
  assert (select count(*) from private.audit_logs where entity = 'assessment_late_releases') >= 3, '8 auditoria nao gravou';
  begin insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_past,e1,now(),coord,'duplicada duplicada'); assert false, '9 duplicada passou';
  exception when unique_violation then null; end;
  begin insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_future,e1,now(),coord,'curto'); assert false, '10 motivo curto passou';
  exception when check_violation then null; end;

  -- 11 a 13 aluno: ve so a sua, nao insere, nao atualiza
  perform set_config('app.uid', s1::text, false); perform set_config('app.role','student',false);
  set local role authenticated;
  assert (select count(*) from public.assessment_late_releases) = 1, '11 aluno deveria ver so a sua liberacao';
  begin insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_future,e1,now()+interval '1 day',s1,'aluno tentando liberar'); assert false, '12 aluno inseriu';
  exception when insufficient_privilege then null; end;
  update public.assessment_late_releases set valid_until = now()+interval '9 days';
  reset role;
  assert (select count(*) from public.assessment_late_releases where valid_until > now()+interval '8 days') = 0, '13 aluno conseguiu atualizar';

  -- 14 a 17 coordenacao: ve tudo, insere, renova, e so em seu proprio nome
  perform set_config('app.uid', coord::text, false); perform set_config('app.role','coordinator',false);
  set local role authenticated;
  assert (select count(*) from public.assessment_late_releases) = 2, '14 coordenacao deveria ver todas';
  insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_future,e1,now()+interval '1 day',coord,'liberacao pela coordenacao');
  update public.assessment_late_releases set valid_until = now()+interval '24 hours', granted_by = coord where assessment_id = a_future;
  begin insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a_past,e2,now(),s1,'em nome de outra pessoa'); assert false, '17 granted_by de outra pessoa passou';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
select 'CENARIOS OK' as resultado;
