-- Cenarios do pedido feito pelo proprio aluno (migracao 088). Falha (ASSERT) se algo regredir.
-- Postgres LOCAL e descartavel, NUNCA producao. Ordem: late_release_stub.sql, migracoes 087 e 088, este arquivo.
-- Saida esperada: "CENARIOS DO PEDIDO OK".
set client_min_messages = warning;
truncate public.assessments, public.enrollments, public.assessment_attempts, public.assessment_exceptional_grants, public.assessment_late_releases cascade;
delete from auth.users;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000a3'),('00000000-0000-0000-0000-0000000000a4'),('00000000-0000-0000-0000-0000000000c1');

do $$
declare
  o uuid := gen_random_uuid();
  a_open uuid := gen_random_uuid();      -- prazo vencido, janela aberta
  a_noWin uuid := gen_random_uuid();     -- prazo vencido, janela desligada (nula)
  a_winEnd uuid := gen_random_uuid();    -- prazo vencido, janela encerrada
  a_future uuid := gen_random_uuid();    -- prazo no futuro
  a_draft uuid := gen_random_uuid();
  s1 uuid := '00000000-0000-0000-0000-0000000000a1'; s2 uuid := '00000000-0000-0000-0000-0000000000a2';
  s3 uuid := '00000000-0000-0000-0000-0000000000a3'; s4 uuid := '00000000-0000-0000-0000-0000000000a4';
  coord uuid := '00000000-0000-0000-0000-0000000000c1';
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid();
  r public.assessment_late_releases; r2 public.assessment_late_releases;
  t public.assessment_attempts; msg text;
begin
  insert into public.assessments(id,status,closes_at,late_requests_until,season_volume_offering_id) values
    (a_open,'open',now()-interval '2 hours',now()+interval '3 hours',o),
    (a_noWin,'open',now()-interval '2 hours',null,o),
    (a_winEnd,'open',now()-interval '2 hours',now()-interval '1 minute',o),
    (a_future,'open',now()+interval '2 hours',now()+interval '3 hours',o),
    (a_draft,'draft',now()-interval '2 hours',now()+interval '3 hours',o);
  insert into public.enrollments(id,student_id,season_volume_offering_id,status) values (e1,s1,o,'active'),(e2,s2,o,'active'),(e3,s3,o,'canceled');

  -- 1 aluno sem tentativa pede e a liberacao nasce de 24 horas, origem aluno, com o motivo
  perform set_config('app.uid', s1::text, false);
  r := public.request_late_release(a_open, '  Fiquei sem internet o prazo todo.  ');
  assert r.source = 'student', '1 origem deveria ser student';
  assert r.reason = 'Fiquei sem internet o prazo todo.', '1 motivo deveria vir sem espacos nas pontas';
  assert r.granted_by = s1, '1 granted_by deveria ser o proprio aluno';
  assert round(extract(epoch from (r.valid_until - now()))/3600) = 24, '1 deveria valer 24 horas';

  -- 2 e inicia a prova (usa a funcao da migracao 087 se estiver carregada)
  if to_regprocedure('public.start_assessment_attempt(uuid)') is not null then
    t := public.start_assessment_attempt(a_open);
    assert t.attempt_kind = 'regular', '2 deveria iniciar depois de pedir';
  end if;

  -- 3 segundo pedido nao cria outra liberacao e devolve a mesma
  r2 := public.request_late_release(a_open, 'Pedindo uma segunda vez agora');
  assert r2.id = r.id, '3 deveria devolver a liberacao existente';
  assert r2.reason = r.reason, '3 nao pode trocar o motivo';
  assert (select count(*) from public.assessment_late_releases where enrollment_id = e1) = 1, '3 so uma liberacao';

  -- 4 liberacao vencida: o pedido devolve a vencida, sem renovar, e o inicio continua barrado
  update public.assessment_late_releases set valid_until = now() - interval '1 minute' where id = r.id;
  r2 := public.request_late_release(a_open, 'Pedindo depois de vencer a liberacao');
  assert r2.id = r.id and r2.valid_until < now(), '4 nao pode renovar sozinho';

  -- 5 aluno com tentativa (qualquer status) e recusado
  perform set_config('app.uid', s2::text, false);
  insert into public.assessment_attempts(assessment_id, enrollment_id, status, attempt_kind, deadline_at) values (a_open, e2, 'expired', 'regular', now()-interval '3 hours');
  begin perform public.request_late_release(a_open, 'Tentando mesmo ja tendo feito'); assert false, '5 aceitou aluno com tentativa';
  exception when others then
    get stacked diagnostics msg = message_text;
    assert msg like 'Voc_ j_ fez esta avalia%', '5 mensagem errada: ' || msg;
  end;
  assert (select count(*) from public.assessment_late_releases where enrollment_id = e2) = 0, '5 nao pode criar liberacao';

  -- 6 fora da janela (desligada ou encerrada) e recusado; prazo no futuro tambem; avaliacao nao aberta tambem
  perform set_config('app.uid', s1::text, false);
  delete from public.assessment_late_releases;   -- limpa para testar as outras regras
  delete from public.assessment_attempts where enrollment_id = e1;
  begin perform public.request_late_release(a_noWin, 'Janela desligada, tentando pedir'); assert false, '6a janela desligada passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Os pedidos de libera%', '6a ' || msg; end;
  begin perform public.request_late_release(a_winEnd, 'Janela encerrada, tentando pedir'); assert false, '6b janela encerrada passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Os pedidos de libera%', '6b ' || msg; end;
  begin perform public.request_late_release(a_future, 'Prazo ainda nao encerrou ainda'); assert false, '6c prazo futuro passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'O prazo desta avalia%ainda n%', '6c ' || msg; end;
  begin perform public.request_late_release(a_draft, 'Avaliacao ainda em rascunho aqui'); assert false, '6d rascunho passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Esta avalia%n_o est_ aberta.', '6d ' || msg; end;

  -- 7 motivo curto, vazio, nulo e longo demais sao recusados
  begin perform public.request_late_release(a_open, 'curto'); assert false, '7a curto passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Conte o motivo%', '7a ' || msg; end;
  begin perform public.request_late_release(a_open, '         '); assert false, '7b vazio passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Conte o motivo%', '7b ' || msg; end;
  begin perform public.request_late_release(a_open, null); assert false, '7c nulo passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Conte o motivo%', '7c ' || msg; end;
  begin perform public.request_late_release(a_open, repeat('a', 501)); assert false, '7d longo passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Conte o motivo%', '7d ' || msg; end;
  r := public.request_late_release(a_open, repeat('a', 500));
  assert char_length(r.reason) = 500, '7e 500 caracteres deveria passar';

  -- 8 sem matricula ativa e sem sessao
  perform set_config('app.uid', s3::text, false);
  begin perform public.request_late_release(a_open, 'Matricula cancelada tentando pedir'); assert false, '8a matricula cancelada passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Voc_ n_o tem matr%', '8a ' || msg; end;
  perform set_config('app.uid', s4::text, false);
  begin perform public.request_late_release(a_open, 'Sem matricula nenhuma aqui'); assert false, '8b sem matricula passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Voc_ n_o tem matr%', '8b ' || msg; end;
  perform set_config('app.uid', '', false);
  begin perform public.request_late_release(a_open, 'Sem sessao nenhuma aqui'); assert false, '8c sem sessao passou';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Entre na plataforma%', '8c ' || msg; end;

  -- 9 a coordenacao muda e desliga a janela; aluno nao consegue
  perform set_config('app.uid', s1::text, false); perform set_config('app.role', 'student', false);
  begin perform public.set_late_requests_window(a_noWin, now() + interval '1 day'); assert false, '9a aluno mexeu na janela';
  exception when others then get stacked diagnostics msg = message_text; assert msg like 'Sem permiss%', '9a ' || msg; end;
  perform set_config('app.uid', coord::text, false); perform set_config('app.role', 'coordinator', false);
  perform public.set_late_requests_window(a_noWin, now() + interval '1 day');
  assert (select late_requests_until from public.assessments where id = a_noWin) > now(), '9b janela deveria ligar';
  perform public.set_late_requests_window(a_noWin, null);
  assert (select late_requests_until from public.assessments where id = a_noWin) is null, '9c janela deveria desligar';

  -- 10 o aluno nunca grava direto na tabela (so pela funcao)
  perform set_config('app.uid', s1::text, false); perform set_config('app.role', 'student', false);
  delete from public.assessment_late_releases;
  set local role authenticated;
  begin insert into public.assessment_late_releases(assessment_id,enrollment_id,valid_until,granted_by,reason,source) values (a_open,e1,now()+interval '1 day',s1,'gravando direto na tabela','student'); assert false, '10 aluno gravou direto';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
select 'CENARIOS DO PEDIDO OK' as resultado;
