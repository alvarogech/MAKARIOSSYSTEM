-- Publicar a avaliação (o momento em que o conjunto de elegíveis é
-- congelado — doc explícito desta fase) e liberação manual do gabarito
-- pela coordenação (doc 02 §7, terceira condição).

create or replace function public.publish_assessment(p_assessment_id uuid)
returns public.assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessments%rowtype;
begin
  if not (public.has_role('coordinator') or public.has_role('admin')) then
    raise exception 'Sem permissão para publicar avaliações.';
  end if;

  select * into v_assessment from public.assessments where id = p_assessment_id;

  if v_assessment.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  -- Conjunto fixo de elegíveis: matrículas ativas/em regularização/
  -- aprovadas na oferta, no exato momento da publicação. Nunca
  -- recalculado depois — uma matrícula criada mais tarde não entra aqui.
  insert into public.assessment_eligible_students (assessment_id, enrollment_id)
  select p_assessment_id, e.id
  from public.enrollments e
  where e.season_volume_offering_id = v_assessment.season_volume_offering_id
    and e.status in ('active', 'regularization', 'approved')
  on conflict (assessment_id, enrollment_id) do nothing;

  update public.assessments set status = 'open' where id = p_assessment_id
  returning * into v_assessment;

  return v_assessment;
end;
$$;

revoke execute on function public.publish_assessment(uuid) from public, anon;
grant execute on function public.publish_assessment(uuid) to authenticated;

create or replace function public.release_answer_key_manually(p_assessment_id uuid)
returns public.assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessments%rowtype;
begin
  if not (public.has_role('coordinator') or public.has_role('admin')) then
    raise exception 'Sem permissão para liberar gabarito.';
  end if;

  update public.assessments
  set answer_key_released_at = coalesce(answer_key_released_at, now()),
      answer_key_release_reason = coalesce(answer_key_release_reason, 'manual')
  where id = p_assessment_id
  returning * into v_assessment;

  if v_assessment.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  return v_assessment;
end;
$$;

revoke execute on function public.release_answer_key_manually(uuid) from public, anon;
grant execute on function public.release_answer_key_manually(uuid) to authenticated;
