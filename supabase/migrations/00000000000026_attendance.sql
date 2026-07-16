-- Fase 4 — Área do professor: frequência (doc 02 §9).
--
-- Distinção importante, da matriz de permissões (PLANO_TECNICO.md seção 3):
-- professor REGISTRA frequência, mas não CORRIGE depois. Implementado via
-- `finalized_at`: enquanto nulo, é "rascunho" e o próprio professor pode
-- ajustar; depois de finalizado, só coordenação/admin conseguem alterar
-- (a policy de UPDATE do professor exige finalized_at IS NULL tanto no
-- estado atual quanto no resultado — ele não consegue nem finalizar
-- sozinho via UPDATE direto, só pela função finalize_attendance abaixo).

create type public.attendance_status as enum (
  'presente',
  'ausente',
  'atrasado',
  'presenca_parcial',
  'falta_justificada',
  'reposicao',
  'pendente'
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  status public.attendance_status not null default 'pendente',
  recognized_minutes integer not null default 0,
  observation text,
  recorded_by uuid not null references auth.users (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint attendance_records_enrollment_meeting_unique unique (enrollment_id, meeting_id),
  constraint attendance_records_recognized_minutes_non_negative check (recognized_minutes >= 0)
);

comment on table public.attendance_records is
  'Registro original da presença. NUNCA reescrito por uma reposição — '
  'ver PLANO_TECNICO.md seção 14 ("crédito separado", modelado na Fase 6).';

create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- Histórico dedicado (doc 02 §9.9: "Alterações devem registrar valor
-- anterior, valor novo, responsável, data e justificativa"). Preenchido
-- só em UPDATE que muda status/minutos — o registro inicial não é uma
-- "alteração". `changed_by`/`justification` reaproveitam exatamente o
-- mecanismo de sessão já criado na Fase 1
-- (public.set_audit_justification / app.actor_id).
create table public.attendance_change_history (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records (id) on delete cascade,
  previous_status public.attendance_status,
  new_status public.attendance_status,
  previous_minutes integer,
  new_minutes integer,
  changed_by uuid,
  justification text,
  changed_at timestamptz not null default now()
);

create or replace function public.log_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_justification text;
begin
  if old.status is distinct from new.status or old.recognized_minutes is distinct from new.recognized_minutes then
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

    insert into public.attendance_change_history (
      attendance_record_id, previous_status, new_status, previous_minutes, new_minutes, changed_by, justification
    ) values (
      new.id, old.status, new.status, old.recognized_minutes, new.recognized_minutes, v_actor, v_justification
    );
  end if;
  return new;
end;
$$;

create trigger attendance_records_log_change
  after update on public.attendance_records
  for each row execute function public.log_attendance_change();

-- Defesa em profundidade: a matrícula precisa pertencer à mesma turma do
-- encontro (mesmo padrão de enforce_enrollment_class_offering, Fase 2).
create or replace function public.enforce_attendance_class_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_class_id uuid;
  v_meeting_class_id uuid;
begin
  select class_id into v_enrollment_class_id from public.enrollments where id = new.enrollment_id;
  select class_id into v_meeting_class_id from public.class_meetings where id = new.meeting_id;

  if v_enrollment_class_id is null or v_meeting_class_id is null or v_enrollment_class_id <> v_meeting_class_id then
    raise exception
      'A matrícula % não pertence à turma do encontro %.', new.enrollment_id, new.meeting_id;
  end if;

  return new;
end;
$$;

create trigger attendance_records_enforce_class_consistency
  before insert or update of enrollment_id, meeting_id on public.attendance_records
  for each row execute function public.enforce_attendance_class_consistency();

-- Verdadeiro se o usuário autenticado tem QUALQUER vínculo (turma inteira
-- ou encontro específico) com a turma informada — única fonte de verdade
-- do escopo do professor (nunca user_roles).
create or replace function public.is_teacher_assigned_to_class(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.teacher_assignments
    where teacher_id = auth.uid() and class_id = p_class_id
  );
$$;

-- Encerra o "rascunho" de frequência de um encontro — só a partir daqui a
-- correção passa a exigir coordenação/admin. SECURITY DEFINER porque a
-- policy de UPDATE do professor propositalmente não permite setar
-- finalized_at (ver comentário no topo do arquivo).
create or replace function public.finalize_attendance(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
begin
  select class_id into v_class_id from public.class_meetings where id = p_meeting_id;

  if v_class_id is null then
    raise exception 'Encontro não encontrado.';
  end if;

  if not (
    public.has_role('coordinator') or public.has_role('admin')
    or public.is_teacher_assigned_to_class(v_class_id)
  ) then
    raise exception 'Você não tem permissão para finalizar a frequência deste encontro.';
  end if;

  update public.attendance_records
  set finalized_at = now()
  where meeting_id = p_meeting_id and finalized_at is null;
end;
$$;

revoke execute on function public.finalize_attendance(uuid) from public, anon;
grant execute on function public.finalize_attendance(uuid) to authenticated;

alter table public.attendance_records enable row level security;
alter table public.attendance_change_history enable row level security;

create policy attendance_records_select_own_student
  on public.attendance_records for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy attendance_records_select_teacher
  on public.attendance_records for select to authenticated
  using (
    public.has_role('teacher')
    and public.is_teacher_assigned_to_class(
      (select class_id from public.class_meetings where id = meeting_id)
    )
  );

create policy attendance_records_select_coordinator_admin
  on public.attendance_records for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

-- Registrar (INSERT): professor só nas próprias turmas; coordenação/admin
-- em qualquer turma.
create policy attendance_records_insert_teacher
  on public.attendance_records for insert to authenticated
  with check (
    public.has_role('teacher')
    and public.is_teacher_assigned_to_class(
      (select class_id from public.class_meetings where id = meeting_id)
    )
    and recorded_by = auth.uid()
  );

create policy attendance_records_insert_coordinator_admin
  on public.attendance_records for insert to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and recorded_by = auth.uid()
  );

-- Corrigir (UPDATE): professor só enquanto ainda é rascunho (finalized_at
-- nulo, nos dois lados da checagem); coordenação/admin sempre — reflete
-- a matriz "Corrigir frequência: Professor Não / Coordenação Sim /
-- Administrador Sim" (PLANO_TECNICO.md seção 3).
create policy attendance_records_update_teacher_draft
  on public.attendance_records for update to authenticated
  using (
    finalized_at is null
    and public.has_role('teacher')
    and public.is_teacher_assigned_to_class(
      (select class_id from public.class_meetings where id = meeting_id)
    )
  )
  with check (
    finalized_at is null
    and public.has_role('teacher')
    and public.is_teacher_assigned_to_class(
      (select class_id from public.class_meetings where id = meeting_id)
    )
  );

create policy attendance_records_update_coordinator_admin
  on public.attendance_records for update to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

-- Histórico: leitura para o próprio aluno (via a matrícula), professor da
-- turma e coordenação/admin. Nunca escrito diretamente — só pelo trigger.
create policy attendance_change_history_select_own_student
  on public.attendance_change_history for select to authenticated
  using (exists (
    select 1 from public.attendance_records a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = attendance_record_id and e.student_id = auth.uid()
  ));

create policy attendance_change_history_select_teacher
  on public.attendance_change_history for select to authenticated
  using (exists (
    select 1 from public.attendance_records a
    where a.id = attendance_record_id
      and public.has_role('teacher')
      and public.is_teacher_assigned_to_class(
        (select class_id from public.class_meetings where id = a.meeting_id)
      )
  ));

create policy attendance_change_history_select_coordinator_admin
  on public.attendance_change_history for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
