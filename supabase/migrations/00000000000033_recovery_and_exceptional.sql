-- Recuperação (trilha de revisão obrigatória, doc 02 §8) e tentativa
-- excepcional (sempre manual, auditada — doc 02 §8 / §15).

create table public.recovery_path_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  content_id uuid references public.contents (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete cascade,
  order_index integer not null,
  created_at timestamptz not null default now(),
  constraint recovery_path_items_one_target check (
    (content_id is not null and activity_id is null)
    or (content_id is null and activity_id is not null)
  )
);

comment on table public.recovery_path_items is
  'Trilha de revisão obrigatória antes da tentativa de recuperação (doc '
  '02 §8: "Antes da recuperação, o aluno deve concluir o percurso de '
  'revisão definido"). Cada item é um conteúdo OU um exercício.';

-- Verdadeiro se a matrícula já cumpriu todos os itens da trilha de
-- revisão da avaliação de recuperação informada. Sem itens = trilha
-- trivialmente concluída (nada a exigir).
create or replace function public.is_recovery_path_completed(p_assessment_id uuid, p_enrollment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_item record;
begin
  for v_item in
    select content_id, activity_id from public.recovery_path_items where assessment_id = p_assessment_id
  loop
    if v_item.content_id is not null then
      if not exists (
        select 1 from public.content_progress
        where enrollment_id = p_enrollment_id
          and content_id = v_item.content_id
          and completed_at is not null
      ) then
        return false;
      end if;
    elsif v_item.activity_id is not null then
      if not exists (
        select 1 from public.activity_attempts
        where enrollment_id = p_enrollment_id
          and activity_id = v_item.activity_id
          and status = 'submitted'
      ) then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

-- Tentativa excepcional: sempre uma concessão manual e justificada da
-- coordenação/admin (doc 02 §8, §15 — auditado).
create table public.assessment_exceptional_grants (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  granted_by uuid not null references auth.users (id) on delete restrict,
  justification text not null,
  created_at timestamptz not null default now(),
  constraint assessment_exceptional_grants_unique unique (assessment_id, enrollment_id)
);

create trigger assessment_exceptional_grants_audit
  after insert or delete on public.assessment_exceptional_grants
  for each row execute function private.log_audit_event();

alter table public.recovery_path_items enable row level security;
alter table public.assessment_exceptional_grants enable row level security;

create policy recovery_path_items_select_staff
  on public.recovery_path_items for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy recovery_path_items_select_student
  on public.recovery_path_items for select to authenticated
  using (
    public.has_role('student')
    and exists (
      select 1 from public.assessments a
      where a.id = assessment_id
        and public.has_active_enrollment_in_offering(a.season_volume_offering_id)
    )
  );

create policy recovery_path_items_write_staff
  on public.recovery_path_items for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy assessment_exceptional_grants_select_own
  on public.assessment_exceptional_grants for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy assessment_exceptional_grants_select_staff
  on public.assessment_exceptional_grants for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy assessment_exceptional_grants_insert_staff
  on public.assessment_exceptional_grants for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and granted_by = auth.uid()
  );
