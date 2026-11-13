-- Parte 4 (revisao do Leo): segunda trava do gabarito, por COLUNA, e limite das 24 horas no banco.
--
-- B2 (trava por coluna): a resposta certa da tentativa (correct_option_ids_snapshot) sai do alcance da
--   API para anon e authenticated, mesmo que uma politica de linha algum dia seja trocada. Depois da 089
--   (politica por linha), esta e a segunda trava. As telas nao leem a tabela direto: a prova usa
--   get_assessment_attempt_questions e a revisao usa get_assessment_attempt_review, ambas security definer
--   (rodam como dono e continuam lendo tudo). O select nas demais colunas continua liberado para authenticated.
--   A lista de colunas e montada a partir da tabela de verdade (menos a resposta certa), entao nao depende
--   de memoria. Efeito colateral aceito: select * por authenticated passa a falhar nessa tabela.
-- S4 (limite no banco): coordenacao e admin nao conseguem gravar valid_until alem de 25 horas pela API
--   (o site grava 24 horas; a folga e de 1 hora). A funcao request_late_release e security definer e grava
--   24 horas. Tambem tira delete e truncate da tabela para anon e authenticated.
--
-- So ASCII, idempotente. Depende das migracoes 031, 087 e 089.

revoke select on table public.assessment_attempt_questions from anon, authenticated;

do $$
declare
  v_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'assessment_attempt_questions'
    and column_name <> 'correct_option_ids_snapshot';

  execute format('grant select (%s) on table public.assessment_attempt_questions to authenticated', v_cols);
end
$$;

drop policy if exists assessment_late_releases_insert_staff on public.assessment_late_releases;
create policy assessment_late_releases_insert_staff
  on public.assessment_late_releases for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and granted_by = auth.uid()
    and valid_until <= now() + interval '25 hours'
  );

drop policy if exists assessment_late_releases_update_staff on public.assessment_late_releases;
create policy assessment_late_releases_update_staff
  on public.assessment_late_releases for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and granted_by = auth.uid()
    and valid_until <= now() + interval '25 hours'
  );

revoke delete, truncate on public.assessment_late_releases from anon, authenticated;
