-- Cronômetro server-authoritative de verdade (doc 06 §9): a validação do
-- prazo já acontece a cada `submit_assessment_answer`/
-- `finalize_assessment_attempt` (então nenhuma nota indevida é possível
-- mesmo se o cron atrasar) — esta varredura periódica só encerra
-- tentativas abandonadas (aluno fechou a aba no meio da prova) e libera o
-- gabarito por prazo, sem depender de alguém abrir a página depois.
--
-- PENDÊNCIA DE VERIFICAÇÃO (declarada em FASE_5_RELATORIO.md): esta
-- migration não pôde ser aplicada nem testada contra um projeto Supabase
-- real nesta sessão (sem Docker/CLI disponíveis). `pg_cron` precisa estar
-- habilitável no projeto (é o padrão documentado do Supabase, mas
-- confirmar ao aplicar em homologação/produção).

create extension if not exists pg_cron;

-- Libera o gabarito de avaliações abertas quando a primeira condição do
-- doc 02 §7 for satisfeita: todos os elegíveis enviaram, OU o prazo
-- encerrou. Liberação manual é tratada à parte, pela coordenação
-- (release_answer_key), e já bloqueia esta função de agir de novo.
create or replace function public.evaluate_answer_key_release()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment record;
  v_eligible_count integer;
  v_submitted_count integer;
  v_released_count integer := 0;
begin
  for v_assessment in
    select id, closes_at from public.assessments
    where status = 'open' and answer_key_released_at is null
  loop
    select count(*) into v_eligible_count
    from public.assessment_eligible_students
    where assessment_id = v_assessment.id;

    select count(distinct aa.enrollment_id) into v_submitted_count
    from public.assessment_attempts aa
    join public.assessment_eligible_students es
      on es.assessment_id = aa.assessment_id and es.enrollment_id = aa.enrollment_id
    where aa.assessment_id = v_assessment.id
      and aa.status in ('submitted', 'expired');

    if v_eligible_count > 0 and v_submitted_count >= v_eligible_count then
      update public.assessments
      set answer_key_released_at = now(), answer_key_release_reason = 'all_submitted'
      where id = v_assessment.id;
      v_released_count := v_released_count + 1;
    elsif v_assessment.closes_at is not null and now() > v_assessment.closes_at then
      update public.assessments
      set answer_key_released_at = now(), answer_key_release_reason = 'deadline'
      where id = v_assessment.id;
      v_released_count := v_released_count + 1;
    end if;
  end loop;

  return v_released_count;
end;
$$;

revoke execute on function public.evaluate_answer_key_release() from public, anon, authenticated;
grant execute on function public.evaluate_answer_key_release() to service_role;

select cron.schedule(
  'expire-assessment-attempts',
  '* * * * *',
  $$select public.expire_assessment_attempts();$$
);

select cron.schedule(
  'evaluate-answer-key-release',
  '* * * * *',
  $$select public.evaluate_answer_key_release();$$
);
