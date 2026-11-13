-- Parte 3: fechar a leitura do gabarito durante a prova.
--
-- Problemas (conferidos no codigo):
--   1. get_assessment_attempt_review so conferia o dono e se o gabarito foi liberado, nao o
--      status da tentativa. Com o gabarito ja liberado pelo prazo, quem faz a prova depois (liberacao
--      de 24 horas) recebia correctOptionIds no meio da prova.
--   2. As politicas assessment_attempt_questions_select_own (migracao 031) e assessment_answers_select_own
--      (migracao 032) deixavam o aluno ler a propria tentativa em qualquer momento, inclusive
--      correct_option_ids_snapshot e is_correct, direto na tabela, ate na prova normal.
--
-- O que muda:
--   a. get_assessment_attempt_review: copia INTEIRA da definicao da 032, mais uma conferencia: a
--      tentativa precisa estar submitted ou expired. Nada mais muda.
--   b. As duas politicas "select_own" passam a exigir tentativa submitted ou expired E gabarito
--      liberado (answer_key_released_at nao nulo), pela funcao attempt_review_open. As politicas
--      da equipe (coordenacao e admin) ficam intactas.
--
-- O aplicativo nao le essas tabelas direto com a sessao do aluno: usa so
-- get_assessment_attempt_questions (prova) e get_assessment_attempt_review (revisao), ambas
-- security definer. question_bank e question_options so tem politica de leitura para a equipe.
--
-- So ASCII (acentos como E'\uXXXX'), idempotente. Depende da migracao 032.

-- Verdadeiro so quando a tentativa e do aluno logado, ja terminou e o gabarito da avaliacao foi liberado.
-- security definer para nao depender da politica de leitura de assessments dentro da politica de RLS.
create or replace function public.attempt_review_open(p_attempt_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.assessment_attempts a
    join public.enrollments e on e.id = a.enrollment_id
    join public.assessments s on s.id = a.assessment_id
    where a.id = p_attempt_id
      and e.student_id = auth.uid()
      and a.status in ('submitted', 'expired')
      and s.answer_key_released_at is not null
  );
$$;

revoke execute on function public.attempt_review_open(uuid) from public, anon;
grant execute on function public.attempt_review_open(uuid) to authenticated;

drop policy if exists assessment_attempt_questions_select_own on public.assessment_attempt_questions;
create policy assessment_attempt_questions_select_own
  on public.assessment_attempt_questions for select to authenticated
  using (public.attempt_review_open(attempt_id));

drop policy if exists assessment_answers_select_own on public.assessment_answers;
create policy assessment_answers_select_own
  on public.assessment_answers for select to authenticated
  using (public.attempt_review_open(attempt_id));

create or replace function public.get_assessment_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean;
  v_assessment_id uuid;
  v_released_at timestamptz;
begin
  select (e.student_id = auth.uid()), a.assessment_id
  into v_owner, v_assessment_id
  from public.assessment_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt_id;

  if v_owner is not true then
    raise exception E'Tentativa n\u00e3o encontrada ou n\u00e3o pertence a este usu\u00e1rio.';
  end if;

  -- Gabarito so para quem ja terminou: tentativa em andamento nunca le a resposta certa,
  -- mesmo com o gabarito da avaliacao ja liberado (ex.: prova feita depois do prazo).
  if not exists (
    select 1 from public.assessment_attempts
    where id = p_attempt_id and status in ('submitted', 'expired')
  ) then
    raise exception E'Termine a avalia\u00e7\u00e3o para ver o gabarito.';
  end if;

  select answer_key_released_at into v_released_at
  from public.assessments where id = v_assessment_id;

  if v_released_at is null then
    raise exception E'O gabarito desta avalia\u00e7\u00e3o ainda n\u00e3o foi liberado.';
  end if;

  -- explanation/bible_reference vem ao vivo de question_bank (texto
  -- informativo, nao integridade de correcao  o que decide acerto/erro
  -- e sempre o snapshot, correct_option_ids_snapshot, nunca isto).
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'questionId', aq.question_id,
        'position', aq.position,
        'prompt', aq.prompt,
        'options', aq.options_snapshot,
        'correctOptionIds', aq.correct_option_ids_snapshot,
        'selectedOptionIds', coalesce(aa.selected_option_ids, '[]'::jsonb),
        'isCorrect', coalesce(aa.is_correct, false),
        'explanation', q.explanation,
        'bibleReference', q.bible_reference
      )
      order by aq.position
    )
    from public.assessment_attempt_questions aq
    left join public.assessment_answers aa
      on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
    left join public.question_bank q on q.id = aq.question_id
    where aq.attempt_id = p_attempt_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_assessment_attempt_review(uuid) from public, anon;
grant execute on function public.get_assessment_attempt_review(uuid) to authenticated;
