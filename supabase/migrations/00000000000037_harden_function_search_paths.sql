-- Hardening pós-deploy: o advisor de segurança do Supabase (get_advisors,
-- lint function_search_path_mutable) apontou 4 funções sem `search_path`
-- fixo — inconsistente com o padrão já usado em todas as outras funções do
-- projeto, e um vetor real de search_path hijacking (uma role com
-- privilégio de criar objetos em outro schema do search_path do usuário
-- poderia shadowear uma função/tabela referenciada sem schema qualificado).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_audit_justification(p_justification text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config('app.justification', p_justification, true);
end;
$$;

create or replace function public.forbid_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'assessment_attempt_questions é um snapshot imutável — não pode ser alterado.';
end;
$$;

create or replace function public.forbid_eligibility_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'assessment_eligible_students é um conjunto fixo — não pode ser alterado depois de calculado.';
end;
$$;
