-- Matrícula. Um aluno pode ter várias (um por season_volume_offering),
-- inclusive duas ao mesmo tempo em volumes diferentes na mesma temporada
-- (doc 02 §1). Nunca criada pelo próprio aluno.

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  season_volume_offering_id uuid not null references public.season_volume_offerings (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  status text not null default 'active'
    check (status in (
      'active', 'regularization', 'approved', 'failed', 'canceled', 'withdrawn'
    )),
  authorized_at timestamptz not null default now(),
  authorized_by uuid not null references auth.users (id) on delete restrict,
  final_grade numeric(4, 2),
  final_attendance_percent numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_student_offering_unique unique (student_id, season_volume_offering_id)
);

comment on table public.enrollments is
  'Matrícula de um aluno numa oferta de volume, com turma principal. '
  'Sempre manual/importada — nunca criada pelo próprio aluno (doc 02 §1).';

create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

-- Defesa em profundidade: a turma principal de uma matrícula precisa
-- pertencer à mesma oferta da matrícula. A camada de serviço já valida
-- isso antes de chamar o INSERT, mas um trigger garante a invariante
-- mesmo que a escrita não passe pela camada de serviço.
create or replace function public.enforce_enrollment_class_offering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_offering_id uuid;
begin
  select season_volume_offering_id
  into v_class_offering_id
  from public.classes
  where id = new.class_id;

  if v_class_offering_id is null or v_class_offering_id <> new.season_volume_offering_id then
    raise exception
      'A turma % não pertence à oferta de volume % desta matrícula.',
      new.class_id, new.season_volume_offering_id;
  end if;

  return new;
end;
$$;

create trigger enrollments_enforce_class_offering
  before insert or update of class_id, season_volume_offering_id on public.enrollments
  for each row execute function public.enforce_enrollment_class_offering();

create trigger enrollments_audit
  after insert or update or delete on public.enrollments
  for each row execute function private.log_audit_event();

alter table public.enrollments enable row level security;

-- Leitura: o próprio aluno vê as próprias matrículas; coordenação/admin
-- veem todas. Acesso do professor às matrículas de sua turma fica para a
-- Fase 4 (frequência), quando a tela do professor realmente existir.
create policy enrollments_select_own
  on public.enrollments for select to authenticated
  using (student_id = auth.uid());

create policy enrollments_select_coordinator_admin
  on public.enrollments for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

-- Escrita: só coordenação/admin, e sempre com authorized_by = quem está
-- autenticado (nunca em nome de outra pessoa).
create policy enrollments_insert_coordinator_admin
  on public.enrollments for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and authorized_by = auth.uid()
  );

create policy enrollments_update_coordinator_admin
  on public.enrollments for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
