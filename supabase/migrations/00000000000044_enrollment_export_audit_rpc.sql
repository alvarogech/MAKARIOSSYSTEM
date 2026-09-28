-- private.audit_logs não é exposta via API (de propósito — ver README).
-- Mudanças de status já são auditadas automaticamente pelo gatilho
-- anexado em enrollment_requests (migration 043). Mas exportação de CSV e
-- ações em lote não passam por um UPDATE de linha, então não há gatilho
-- que as capture. Esta RPC mínima, SECURITY DEFINER, é o único jeito de
-- registrar esses dois eventos sem expor o schema `private` inteiro.

create or replace function public.log_enrollment_admin_action(
  p_action text,
  p_entity_id text,
  p_new_value jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  if not (public.has_role('coordinator') or public.has_role('admin')) then
    raise exception 'not authorized';
  end if;

  if p_action not in ('EXPORT', 'BULK_STATUS_CHANGE') then
    raise exception 'invalid action';
  end if;

  insert into private.audit_logs (actor_id, action, entity, entity_id, new_value)
  values (auth.uid(), p_action, 'enrollment_requests', p_entity_id, p_new_value);
end;
$$;

revoke all on function public.log_enrollment_admin_action(text, text, jsonb) from public;
grant execute on function public.log_enrollment_admin_action(text, text, jsonb) to authenticated;

comment on function public.log_enrollment_admin_action is
  'Registra em private.audit_logs eventos do dashboard de inscrições que não passam por UPDATE de linha (exportação, ação em lote). Rejeita quem não é coordenador/admin.';
