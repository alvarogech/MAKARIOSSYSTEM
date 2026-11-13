-- Cenarios da migracao 089: gabarito so depois de terminar a prova. Falha (ASSERT) se algo regredir.
-- Postgres LOCAL e descartavel, NUNCA producao. Ordem: late_release_stub.sql, a funcao
-- get_assessment_attempt_review da migracao 032 (como estava antes), as migracoes 087, 088 e 089, este arquivo.
-- Saida esperada: "CENARIOS DO GABARITO OK".
set client_min_messages = warning;
truncate public.assessments, public.enrollments, public.assessment_attempts, public.assessment_attempt_questions, public.assessment_answers, public.question_bank cascade;
delete from auth.users;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000c1');

do $$
declare
  o uuid := gen_random_uuid();
  a_rel uuid := gen_random_uuid(); a_norel uuid := gen_random_uuid();
  q uuid := gen_random_uuid();
  s1 uuid := '00000000-0000-0000-0000-0000000000a1'; s2 uuid := '00000000-0000-0000-0000-0000000000a2';
  coord uuid := '00000000-0000-0000-0000-0000000000c1';
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid();
  t_prog uuid := gen_random_uuid(); t_sub uuid := gen_random_uuid(); t_exp uuid := gen_random_uuid(); t_subnorel uuid := gen_random_uuid(); t_other uuid := gen_random_uuid();
  msg text; res jsonb;
begin
  insert into public.question_bank(id, prompt, type, selection_mode, explanation) values (q, 'Pergunta?', 'x', 'single', 'porque sim');
  insert into public.assessments(id,status,closes_at,answer_key_released_at,season_volume_offering_id) values
    (a_rel,'open',now()-interval '1 day',now()-interval '1 hour',o), (a_norel,'open',now()+interval '1 day',null,o);
  insert into public.enrollments(id,student_id,season_volume_offering_id,status) values (e1,s1,o,'active'),(e2,s2,o,'active');
  insert into public.assessment_attempts(id,assessment_id,enrollment_id,status,attempt_kind,deadline_at) values
    (t_prog,a_rel,e1,'in_progress','regular',now()+interval '1 hour'),
    (t_sub,a_rel,e1,'submitted','regular',now()),
    (t_exp,a_rel,e1,'expired','regular',now()),
    (t_subnorel,a_norel,e1,'submitted','regular',now()),
    (t_other,a_rel,e2,'submitted','regular',now());
  insert into public.assessment_attempt_questions(attempt_id,question_id,position,prompt,question_type,selection_mode,options_snapshot,points,correct_option_ids_snapshot)
    select t,q,1,'Pergunta?','x','single','[]'::jsonb,1,'["opt-certa"]'::jsonb from unnest(array[t_prog,t_sub,t_exp,t_subnorel,t_other]) as t;
  insert into public.assessment_answers(attempt_id,question_id,is_correct)
    select t,q,true from unnest(array[t_prog,t_sub,t_exp,t_subnorel,t_other]) as t;

  perform set_config('app.uid', s1::text, false); perform set_config('app.role','student',false);

  -- 1 em andamento, gabarito ja liberado: nem a funcao nem a tabela entregam
  begin perform public.get_assessment_attempt_review(t_prog); assert false, '1a funcao entregou durante a prova';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Termine a avalia%para ver o gabarito.', '1a mensagem: ' || msg; end;
  set local role authenticated;
  assert (select count(*) from public.assessment_attempt_questions where attempt_id = t_prog) = 0, '1b tabela de questoes vazou durante a prova';
  assert (select count(*) from public.assessment_answers where attempt_id = t_prog) = 0, '1c is_correct vazou durante a prova';
  reset role;

  -- 2 enviada com gabarito liberado: le pela funcao e pela tabela
  res := public.get_assessment_attempt_review(t_sub);
  assert res->0->'correctOptionIds' = '["opt-certa"]'::jsonb, '2a funcao deveria entregar depois de enviar';
  set local role authenticated;
  assert (select count(*) from public.assessment_attempt_questions where attempt_id = t_sub) = 1, '2b tabela deveria abrir depois de enviar';
  assert (select count(*) from public.assessment_answers where attempt_id = t_sub) = 1, '2c respostas deveriam abrir depois de enviar';
  reset role;

  -- 3 tempo acabou (expired) com gabarito liberado: tambem le
  res := public.get_assessment_attempt_review(t_exp);
  assert jsonb_array_length(res) = 1, '3 expired deveria ler';

  -- 4 enviada, gabarito NAO liberado: nao le (funcao e tabela)
  begin perform public.get_assessment_attempt_review(t_subnorel); assert false, '4a entregou sem gabarito liberado';
  exception when others then get stacked diagnostics msg = message_text; assert msg like '%gabarito%n_o foi liberado%', '4a mensagem: ' || msg; end;
  set local role authenticated;
  assert (select count(*) from public.assessment_attempt_questions where attempt_id = t_subnorel) = 0, '4b tabela abriu sem gabarito liberado';
  assert (select count(*) from public.assessment_answers where attempt_id = t_subnorel) = 0, '4c respostas abriram sem gabarito liberado';
  reset role;

  -- 5 tentativa de outro aluno: nao le
  begin perform public.get_assessment_attempt_review(t_other); assert false, '5a leu a tentativa de outro aluno';
  exception when others then null; end;
  set local role authenticated;
  assert (select count(*) from public.assessment_attempt_questions where attempt_id = t_other) = 0, '5b tabela de outro aluno vazou';
  reset role;

  -- 6 a equipe continua lendo tudo, em qualquer status
  perform set_config('app.uid', coord::text, false); perform set_config('app.role','coordinator',false);
  set local role authenticated;
  assert (select count(*) from public.assessment_attempt_questions) = 5, '6a equipe deveria ler todas as questoes';
  assert (select count(*) from public.assessment_answers) = 5, '6b equipe deveria ler todas as respostas';
  reset role;
end $$;
select 'CENARIOS DO GABARITO OK' as resultado;
