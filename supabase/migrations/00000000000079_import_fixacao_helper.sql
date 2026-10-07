-- Importador interno de exercícios de fixação (rascunho), no mesmo formato do piloto Caminho.
-- Idempotente (external_ref único): rodar de novo não duplica. Tudo entra como RASCUNHO; aprovar/publicar
-- continua sendo decisão humana em /conteudo/revisao. Fica no schema private (não exposto pela API).
-- Reversão: drop function private.import_fixacao(text, text, uuid, jsonb);

create or replace function private.import_fixacao(p_volume text, p_prefix text, p_author uuid, p_data jsonb)
returns table (aula text, questoes integer, opcoes integer, pratica boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  q jsonb;
  v_vol uuid;
  v_mod uuid;
  v_les uuid;
  v_act uuid;
  v_q uuid;
  v_idx integer;
  v_j integer;
  n_q integer;
  n_o integer;
  v_pr boolean;
  v_instr constant text :=
    'Cinco questões de fixação. Não vale nota e você pode repetir. Em "marque as duas corretas", a resposta só é considerada certa com as duas alternativas marcadas (sem pontuação parcial).';
begin
  select id into v_vol from public.volumes where name = p_volume;
  if v_vol is null then
    raise exception 'Trilha não encontrada: %', p_volume;
  end if;

  for a in select * from jsonb_array_elements(p_data) loop
    select m.id into v_mod from public.modules m where m.volume_id = v_vol and m.name = a->>'aula';
    if v_mod is null then
      raise exception 'Matéria não encontrada em %: %', p_volume, a->>'aula';
    end if;
    select l.id into v_les from public.lessons l where l.module_id = v_mod order by l.order_index limit 1;

    insert into public.activities (lesson_id, title, instructions, max_attempts, blocks_progress, show_feedback_after_submit, status, external_ref)
    values (v_les, 'Fixação — ' || (a->>'aula'), v_instr, null, false, true, 'draft', p_prefix || '-' || (a->>'slug') || '-fix')
    on conflict (external_ref) do nothing;
    select id into v_act from public.activities where external_ref = p_prefix || '-' || (a->>'slug') || '-fix';

    n_q := 0; n_o := 0; v_idx := 0;
    for q in select * from jsonb_array_elements(a->'q') loop
      v_idx := v_idx + 1;
      v_q := null;
      insert into public.question_bank (volume_id, module_id, lesson_id, type, prompt, explanation, bible_reference, topic, difficulty, status, author_id, selection_mode, external_ref)
      values (
        v_vol, v_mod, v_les, 'multiple_choice', q->>'p',
        (q->>'e') || E'\n\nRevisar na apostila: ' || (q->>'r') || '.',
        nullif(q->>'b', ''), (a->>'aula') || ' — Fixação', q->>'d', 'draft', p_author, q->>'t',
        p_prefix || '-' || (a->>'slug') || '-fix-' || lpad(v_idx::text, 2, '0')
      )
      on conflict (external_ref) do nothing
      returning id into v_q;

      if v_q is not null then
        n_q := n_q + 1;
        for v_j in 0..3 loop
          insert into public.question_options (question_id, label, is_correct, order_index)
          values (v_q, chr(65 + v_j) || ') ' || (q->'o'->>v_j), (q->'c') @> to_jsonb(v_j), v_j);
          n_o := n_o + 1;
        end loop;
        insert into public.activity_questions (activity_id, question_id, order_index) values (v_act, v_q, v_idx - 1);
      end if;
    end loop;

    insert into public.practice_challenges (external_ref, lesson_id, prompt, status, author_id)
    values (p_prefix || '-' || (a->>'slug') || '-desafio', v_les, a->>'pratica', 'draft', p_author)
    on conflict (external_ref) do nothing;
    v_pr := exists (select 1 from public.practice_challenges where external_ref = p_prefix || '-' || (a->>'slug') || '-desafio');

    aula := a->>'aula'; questoes := n_q; opcoes := n_o; pratica := v_pr;
    return next;
  end loop;
end;
$$;

revoke all on function private.import_fixacao(text, text, uuid, jsonb) from public, anon, authenticated;
