-- Piloto Caminho 2026-2 — etapa 2: fluxo de revisão editorial.
-- rascunho -> em revisão -> aprovada -> publicada (+ arquivada), com registro
-- de quem aprovou e quando. Nada vai ao aluno sem aprovação humana
-- autenticada: as regras ficam no banco, não só na interface.

-- 1) question_bank: novos estados + metadados de aprovação
alter table public.question_bank drop constraint question_bank_status_check;
alter table public.question_bank add constraint question_bank_status_check
  check (status in ('draft', 'in_review', 'approved', 'published', 'archived'));

alter table public.question_bank
  add column approved_by uuid references auth.users (id) on delete set null,
  add column approved_at timestamptz,
  add column version integer not null default 1;

-- 2) activities: referência externa (importação idempotente)
alter table public.activities add column external_ref text unique;

-- 3) Desafios práticos sem nota (um por matéria)
create table public.practice_challenges (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  prompt text not null,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'published', 'archived')),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  version integer not null default 1,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.practice_challenges is
  'Desafio prático SEM nota. A conclusão do aluno (e a nota privada opcional) entra numa etapa posterior.';

create trigger practice_challenges_set_updated_at
  before update on public.practice_challenges
  for each row execute function public.set_updated_at();

alter table public.practice_challenges enable row level security;

create policy practice_challenges_select_staff
  on public.practice_challenges for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy practice_challenges_select_student
  on public.practice_challenges for select to authenticated
  using (
    public.has_role('student')
    and status = 'published'
    and public.has_active_enrollment_in_volume(
      (select m.volume_id from public.lessons l join public.modules m on m.id = l.module_id where l.id = lesson_id)
    )
  );

create policy practice_challenges_write_staff
  on public.practice_challenges for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- 4) Regras de transição — iguais para questão e desafio.
-- Só se aplicam a usuário autenticado (auth.uid() não nulo); operações
-- administrativas diretas no banco (migrações, correções) não são barradas.
create or replace function public.enforce_review_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_approver boolean;
  v_content_changed boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_table_name = 'question_bank' then
    v_content_changed := (new.prompt, new.explanation, new.type, new.difficulty, new.topic,
                          new.volume_id, new.module_id, new.lesson_id)
                         is distinct from
                         (old.prompt, old.explanation, old.type, old.difficulty, old.topic,
                          old.volume_id, old.module_id, old.lesson_id);
  else
    v_content_changed := (new.prompt, new.lesson_id) is distinct from (old.prompt, old.lesson_id);
  end if;

  -- conteúdo aprovado/publicado é imutável enquanto continuar assim
  if old.status in ('approved', 'published') and new.status in ('approved', 'published') and v_content_changed then
    raise exception 'Item % já aprovado/publicado — o conteúdo não pode ser alterado (reabra para revisão antes).', old.id;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_is_approver := public.has_role('coordinator') or public.has_role('admin');

  if new.status = 'approved' then
    if old.status <> 'in_review' then
      raise exception 'Só é possível aprovar o que está em revisão (estado atual: %).', old.status;
    end if;
    if not v_is_approver then
      raise exception 'Apenas coordenação ou administração podem aprovar.';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status = 'published' then
    if old.status <> 'approved' then
      raise exception 'Só é possível publicar o que está aprovado (estado atual: %).', old.status;
    end if;
    if not v_is_approver then
      raise exception 'Apenas coordenação ou administração podem publicar.';
    end if;
  elsif new.status in ('draft', 'in_review') then
    -- voltar ao rascunho/revisão invalida a aprovação anterior
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;

create trigger question_bank_review_workflow
  before update on public.question_bank
  for each row execute function public.enforce_review_workflow();

create trigger practice_challenges_review_workflow
  before update on public.practice_challenges
  for each row execute function public.enforce_review_workflow();

-- Alternativas de questão aprovada/publicada são imutáveis para usuários.
create or replace function public.enforce_options_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  v_question_id := coalesce(new.question_id, old.question_id);
  select status into v_status from public.question_bank where id = v_question_id;
  if v_status in ('approved', 'published') then
    raise exception 'Alternativas de questão aprovada/publicada não podem ser alteradas.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger question_options_immutable
  before insert or update or delete on public.question_options
  for each row execute function public.enforce_options_immutable();

-- 5) Publicar exercício exige todas as questões vinculadas já aprovadas.
create or replace function public.enforce_activity_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_blocked integer;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    select count(*), count(*) filter (where q.status not in ('approved', 'published'))
    into v_total, v_blocked
    from public.activity_questions aq
    join public.question_bank q on q.id = aq.question_id
    where aq.activity_id = new.id;

    if v_total = 0 then
      raise exception 'Exercício sem questões não pode ser publicado.';
    end if;
    if v_blocked > 0 then
      raise exception '% questão(ões) do exercício ainda não foram aprovadas.', v_blocked;
    end if;
    if auth.uid() is not null and not (public.has_role('coordinator') or public.has_role('admin')) then
      raise exception 'Apenas coordenação ou administração podem publicar exercícios.';
    end if;
  end if;
  return new;
end;
$$;

create trigger activities_publish_gate
  before update on public.activities
  for each row execute function public.enforce_activity_publish();

-- Questão não aprovada não entra num exercício já publicado.
create or replace function public.enforce_activity_question_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_status text;
  v_question_status text;
begin
  select status into v_activity_status from public.activities where id = new.activity_id;
  select status into v_question_status from public.question_bank where id = new.question_id;
  if v_activity_status = 'published' and v_question_status not in ('approved', 'published') then
    raise exception 'Exercício publicado só aceita questões aprovadas.';
  end if;
  return new;
end;
$$;

create trigger activity_questions_link_gate
  before insert or update on public.activity_questions
  for each row execute function public.enforce_activity_question_link();

-- 6) Auditoria das mudanças
create trigger question_bank_audit
  after update on public.question_bank
  for each row execute function private.log_audit_event();

create trigger activities_audit
  after insert or update on public.activities
  for each row execute function private.log_audit_event();

create trigger practice_challenges_audit
  after insert or update on public.practice_challenges
  for each row execute function private.log_audit_event();
