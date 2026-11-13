-- Parte 2 da liberacao fora do prazo: o PROPRIO ALUNO pede, escrevendo o motivo.
--
-- Decisao do Fernando em 13/11/2026: em vez de chamarem no privado, o aluno
-- entra na plataforma, escreve o motivo e a prova e liberada na hora por 24 horas.
--
-- O que muda:
--   1. assessments.late_requests_until: ate quando a avaliacao aceita pedido de
--      liberacao (nula = nao aceita). Esta migracao NAO preenche a coluna em producao;
--      quem liga a janela e o SQL separado makarios-janela-pedidos.sql ou a tela da coordenacao.
--   2. assessment_late_releases.source: 'student' ou 'staff' (quem originou a liberacao).
--   3. request_late_release(avaliacao, motivo): unica porta de escrita do aluno. security
--      definer, confere tudo no servidor e cria a liberacao de 24 horas. O aluno continua
--      sem permissao de gravar direto na tabela.
--   4. set_late_requests_window(avaliacao, data): coordenacao e admin ligam, mudam ou desligam a janela.
--
-- So ASCII (acentos como E'\uXXXX'), idempotente. Depende da migracao 087.

alter table public.assessments
  add column if not exists late_requests_until timestamptz;

comment on column public.assessments.late_requests_until is
  'Ate quando o aluno pode pedir a liberacao da prova depois do prazo. Nula = nao aceita pedido.';

alter table public.assessment_late_releases
  add column if not exists source text not null default 'staff'
    check (source in ('student', 'staff'));

create or replace function public.request_late_release(p_assessment_id uuid, p_reason text)
returns public.assessment_late_releases
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_assessment public.assessments%rowtype;
  v_enrollment_id uuid;
  v_release public.assessment_late_releases;
begin
  if v_uid is null then
    raise exception E'Entre na plataforma para pedir a libera\u00e7\u00e3o.';
  end if;

  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception E'Conte o motivo com 10 a 500 caracteres.';
  end if;

  select * into v_assessment from public.assessments where id = p_assessment_id;

  if v_assessment.id is null then
    raise exception E'Avalia\u00e7\u00e3o n\u00e3o encontrada.';
  end if;

  if v_assessment.status <> 'open' then
    raise exception E'Esta avalia\u00e7\u00e3o n\u00e3o est\u00e1 aberta.';
  end if;

  select id into v_enrollment_id
  from public.enrollments
  where student_id = v_uid
    and season_volume_offering_id = v_assessment.season_volume_offering_id
    and status in ('active', 'regularization', 'approved')
  limit 1;

  if v_enrollment_id is null then
    raise exception E'Voc\u00ea n\u00e3o tem matr\u00edcula ativa nesta oferta de volume.';
  end if;

  -- Um pedido por aluno por avaliacao: se ja existe liberacao (valida ou vencida), devolve a
  -- existente sem criar outra. Renovar e so pelo botao da coordenacao.
  select * into v_release
  from public.assessment_late_releases
  where assessment_id = p_assessment_id and enrollment_id = v_enrollment_id;

  if v_release.id is not null then
    return v_release;
  end if;

  if v_assessment.closes_at is null or now() <= v_assessment.closes_at then
    raise exception E'O prazo desta avalia\u00e7\u00e3o ainda n\u00e3o encerrou. Voc\u00ea j\u00e1 pode fazer a prova.';
  end if;

  if v_assessment.late_requests_until is null or now() > v_assessment.late_requests_until then
    raise exception E'Os pedidos de libera\u00e7\u00e3o desta avalia\u00e7\u00e3o n\u00e3o est\u00e3o abertos. Fale com a coordena\u00e7\u00e3o da Escola Mak\u00e1rios.';
  end if;

  if exists (
    select 1 from public.assessment_attempts
    where assessment_id = p_assessment_id and enrollment_id = v_enrollment_id
  ) then
    raise exception E'Voc\u00ea j\u00e1 fez esta avalia\u00e7\u00e3o. Se precisar de ajuda, fale com a coordena\u00e7\u00e3o da Escola Mak\u00e1rios.';
  end if;

  insert into public.assessment_late_releases (
    assessment_id, enrollment_id, valid_until, granted_by, reason, source
  ) values (
    p_assessment_id, v_enrollment_id, now() + interval '24 hours', v_uid, v_reason, 'student'
  )
  on conflict (assessment_id, enrollment_id) do nothing
  returning * into v_release;

  -- Dois toques ao mesmo tempo: o segundo cai no conflito e devolve a liberacao do primeiro.
  if v_release.id is null then
    select * into v_release
    from public.assessment_late_releases
    where assessment_id = p_assessment_id and enrollment_id = v_enrollment_id;
  end if;

  return v_release;
end;
$$;

revoke execute on function public.request_late_release(uuid, text) from public, anon;
grant execute on function public.request_late_release(uuid, text) to authenticated;

create or replace function public.set_late_requests_window(p_assessment_id uuid, p_until timestamptz)
returns public.assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment public.assessments;
begin
  if not (public.has_role('coordinator') or public.has_role('admin')) then
    raise exception E'Sem permiss\u00e3o para mudar a janela de pedidos.';
  end if;

  update public.assessments
  set late_requests_until = p_until
  where id = p_assessment_id
  returning * into v_assessment;

  if v_assessment.id is null then
    raise exception E'Avalia\u00e7\u00e3o n\u00e3o encontrada.';
  end if;

  return v_assessment;
end;
$$;

revoke execute on function public.set_late_requests_window(uuid, timestamptz) from public, anon;
grant execute on function public.set_late_requests_window(uuid, timestamptz) to authenticated;
