-- Auditoria (private — nunca exposta pela API pública do Supabase).
-- Preenchida majoritariamente por trigger, como defesa em profundidade:
-- mesmo uma escrita que não passe pela camada de serviço TypeScript deixa
-- rastro. Ver PLANO_TECNICO.md seção 8.

create table private.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  justification text,
  created_at timestamptz not null default now()
);

comment on table private.audit_logs is
  'Trilha de auditoria interna. Populada por gatilhos AFTER UPDATE/DELETE '
  'nas tabelas sensíveis. actor_id vem de auth.uid() quando disponível, com '
  'fallback para a variável de sessão app.actor_id (operações via client '
  'administrativo). justification vem de app.justification, setada por uma '
  'função RPC dentro da mesma transação da escrita (public.set_audit_justification).';

alter table private.audit_logs enable row level security;
-- Nenhuma policy: nem sequer authenticated tem acesso — só o client
-- administrativo (service role, que ignora RLS) ou uma futura função RPC
-- SECURITY DEFINER dedicada à leitura paginada de auditoria (Fase 8).

create or replace function private.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid;
  v_justification text;
  v_entity_id text;
begin
  v_actor := auth.uid();

  if v_actor is null then
    begin
      v_actor := nullif(current_setting('app.actor_id', true), '')::uuid;
    exception when others then
      v_actor := null;
    end;
  end if;

  begin
    v_justification := nullif(current_setting('app.justification', true), '');
  exception when others then
    v_justification := null;
  end;

  if tg_op = 'DELETE' then
    v_entity_id := old.id::text;
  else
    v_entity_id := new.id::text;
  end if;

  insert into private.audit_logs (
    actor_id, action, entity, entity_id, old_value, new_value, justification
  )
  values (
    v_actor,
    tg_op,
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,
    v_justification
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function private.log_audit_event() is
  'Função de gatilho genérica e reutilizável — anexar a qualquer tabela '
  'sensível com: after insert or update or delete ... execute function private.log_audit_event();';

-- Tabelas sensíveis já existentes na Fase 1. Novas tabelas sensíveis
-- (enrollments, attendance_records, assessment_attempts, certificates...)
-- ganham o mesmo gatilho quando forem criadas nas próximas fases.
create trigger profiles_audit
  after update or delete on public.profiles
  for each row execute function private.log_audit_event();

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function private.log_audit_event();

create trigger invitations_audit
  after insert or update or delete on public.invitations
  for each row execute function private.log_audit_event();
