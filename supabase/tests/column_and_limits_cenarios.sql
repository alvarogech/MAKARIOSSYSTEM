-- Cenarios da migracao 090: trava por coluna da resposta certa e limite de 25 horas. Falha (ASSERT) se regredir.
-- Postgres LOCAL e descartavel, NUNCA producao. Ordem: late_release_stub.sql, funcoes originais da 032,
-- migracoes 087, 088, 089 e 090, este arquivo. Saida esperada: "CENARIOS DA 090 OK".
set client_min_messages = warning;
truncate public.assessments, public.enrollments, public.assessment_attempts, public.assessment_attempt_questions, public.assessment_answers, public.question_bank, public.assessment_late_releases cascade;
delete from auth.users;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000c1');

do $$
declare
  o uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); q uuid := gen_random_uuid();
  s1 uuid := '00000000-0000-0000-0000-0000000000a1'; coord uuid := '00000000-0000-0000-0000-0000000000c1';
  e1 uuid := gen_random_uuid(); t uuid := gen_random_uuid(); res jsonb; n int;
begin
  insert into public.question_bank(id, prompt, type, selection_mode) values (q, 'P?', 'x', 'single');
  insert into public.assessments(id,status,closes_at,answer_key_released_at,late_requests_until,season_volume_offering_id)
    values (a1,'open',now()-interval '1 day',now()-interval '1 hour',now()+interval '1 hour',o);
  insert into public.enrollments(id,student_id,season_volume_offering_id,status) values (e1,s1,o,'active');
  insert into public.assessment_attempts(id,assessment_id,enrollment_id,status,attempt_kind,deadline_at) values (t,a1,e1,'submitted','regular',now());
  insert into public.assessment_attempt_questions(attempt_id,question_id,position,prompt,question_type,selection_mode,options_snapshot,points,correct_option_ids_snapshot)
    values (t,q,1,'P?','x','single','[]'::jsonb,1,'["opt-certa"]'::jsonb);

  -- 1 privilegios de coluna (o select de conferencia do Leo)
  assert not has_column_privilege('authenticated', 'public.assessment_attempt_questions', 'correct_option_ids_snapshot', 'SELECT'), '1a authenticated ainda le a resposta certa';
  assert not has_column_privilege('anon', 'public.assessment_attempt_questions', 'correct_option_ids_snapshot', 'SELECT'), '1b anon le a resposta certa';
  assert has_column_privilege('authenticated', 'public.assessment_attempt_questions', 'prompt', 'SELECT'), '1c authenticated deveria ler o enunciado';
  assert has_column_privilege('authenticated', 'public.assessment_attempt_questions', 'options_snapshot', 'SELECT'), '1d authenticated deveria ler as alternativas';
  assert not has_column_privilege('anon', 'public.assessment_attempt_questions', 'prompt', 'SELECT'), '1e anon nao deveria ler nada';

  -- 2 aluno com tentativa enviada e gabarito liberado: linha abre (politica), coluna da resposta certa nao
  perform set_config('app.uid', s1::text, false); perform set_config('app.role','student',false);
  set local role authenticated;
  select count(*) into n from public.assessment_attempt_questions where attempt_id = t;
  assert n = 1, '2a o aluno deveria ver a linha (colunas liberadas)';
  begin perform correct_option_ids_snapshot from public.assessment_attempt_questions where attempt_id = t; assert false, '2b leu a coluna da resposta certa';
  exception when insufficient_privilege then null; end;
  begin perform * from public.assessment_attempt_questions where attempt_id = t; assert false, '2c select * deveria falhar';
  exception when insufficient_privilege then null; end;

  -- 3 a funcao de revisao (security definer) continua entregando a resposta certa depois de enviar
  res := public.get_assessment_attempt_review(t);
  assert res->0->'correctOptionIds' = '["opt-certa"]'::jsonb, '3 revisao deveria seguir funcionando';
  reset role;

  -- 4 limite de 25 horas: coordenacao insere 24h, nao 26h; renova 24h, nao 26h
  perform set_config('app.uid', coord::text, false); perform set_config('app.role','coordinator',false);
  set local role authenticated;
  insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a1,e1,now()+interval '24 hours',coord,'liberacao pela coordenacao');
  update public.assessment_late_releases set valid_until = now()+interval '24 hours', granted_by = coord, reason = 'renovada pela coordenacao';
  begin update public.assessment_late_releases set valid_until = now()+interval '26 hours', granted_by = coord; assert false, '4a renovou alem de 25 horas';
  exception when insufficient_privilege then null; end;
  begin delete from public.assessment_late_releases; assert false, '4b apagou pela API';
  exception when insufficient_privilege then null; end;
  reset role;
  delete from public.assessment_late_releases;
  set local role authenticated;
  begin insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason) values (a1,e1,now()+interval '26 hours',coord,'liberacao por muito tempo'); assert false, '4c inseriu alem de 25 horas';
  exception when insufficient_privilege then null; end;
  reset role;

  -- 5 o pedido do proprio aluno (funcao security definer) continua passando
  delete from public.assessment_attempts;
  perform set_config('app.uid', s1::text, false); perform set_config('app.role','student',false);
  set local role authenticated;
  perform public.request_late_release(a1, 'Fiquei sem internet o prazo todo.');
  reset role;
  assert (select count(*) from public.assessment_late_releases where source = 'student') = 1, '5 o pedido do aluno deveria gravar';
end $$;
select 'CENARIOS DA 090 OK' as resultado;
