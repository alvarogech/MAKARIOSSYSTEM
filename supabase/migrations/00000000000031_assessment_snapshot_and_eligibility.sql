-- Snapshot imutável da prova e conjunto fixo de elegíveis para o
-- gabarito — as duas invariantes de segurança acadêmica exigidas
-- explicitamente para esta fase (mesmo antes de avaliações existirem,
-- já preservadas na Fase 1 como restrição de modelo).
--
-- `assessment_attempts` é criada aqui porque o snapshot referencia a
-- tentativa — ver comentário na tabela.

create type public.assessment_attempt_status as enum (
  'in_progress',
  'submitted',
  'expired',
  'canceled'
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  attempt_kind text not null default 'regular' check (attempt_kind in ('regular', 'exceptional')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status public.assessment_attempt_status not null default 'in_progress',
  score numeric(4, 2),
  correct_count integer,
  total_count integer,
  canceled_at timestamptz,
  canceled_by uuid references auth.users (id),
  cancel_reason text,
  created_at timestamptz not null default now()
);

comment on table public.assessment_attempts is
  'Uma linha por tentativa (regular ou excepcional) de uma avaliação '
  '(final ou recovery) por matrícula. `deadline_at` é calculado no '
  'servidor no início (started_at + duration) — nunca confiar no '
  'relógio do cliente (doc 06 §9).';

-- Snapshot imutável: uma linha por questão apresentada NAQUELA tentativa,
-- com ordem, ordem das alternativas, valor e resposta correta vigentes
-- no momento em que a tentativa começou. Alterações futuras no banco de
-- questões nunca afetam uma prova já iniciada — a correção sempre lê
-- daqui, nunca de `question_bank`/`question_options` diretamente.
create table public.assessment_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete restrict,
  position integer not null,
  prompt text not null,
  question_type text not null,
  selection_mode text not null,
  options_snapshot jsonb not null,
  points numeric(4, 2) not null,
  correct_option_ids_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint assessment_attempt_questions_attempt_position_unique unique (attempt_id, position)
);

comment on table public.assessment_attempt_questions is
  'Snapshot imutável — nunca sofre UPDATE depois de criado (ver trigger '
  'abaixo). options_snapshot guarda [{optionId,label,orderIndex}] já na '
  'ordem embaralhada para esta tentativa; correct_option_ids_snapshot '
  'guarda a resposta correta congelada no momento do início.';

create or replace function public.forbid_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'assessment_attempt_questions é um snapshot imutável — não pode ser alterado.';
end;
$$;

create trigger assessment_attempt_questions_immutable
  before update or delete on public.assessment_attempt_questions
  for each row execute function public.forbid_snapshot_mutation();

-- Conjunto fixo de alunos elegíveis, registrado no momento em que a
-- avaliação é publicada/liberada (doc 02 §7 / requisito explícito desta
-- fase). Consultado para decidir "todos os elegíveis enviaram" — nunca
-- uma query dinâmica de matrículas ativas, então uma matrícula criada
-- depois não atrasa a liberação do gabarito.
create table public.assessment_eligible_students (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  computed_at timestamptz not null default now(),
  constraint assessment_eligible_students_unique unique (assessment_id, enrollment_id)
);

create or replace function public.forbid_eligibility_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'assessment_eligible_students é um conjunto fixo — não pode ser alterado depois de calculado.';
end;
$$;

create trigger assessment_eligible_students_immutable
  before update on public.assessment_eligible_students
  for each row execute function public.forbid_eligibility_mutation();

alter table public.assessment_attempts enable row level security;
alter table public.assessment_attempt_questions enable row level security;
alter table public.assessment_eligible_students enable row level security;

-- Tentativas: o próprio aluno (dono da matrícula) e staff acadêmico
-- (coordenação/admin) leem. Nenhuma policy de INSERT/UPDATE para
-- "authenticated" — só através das funções SECURITY DEFINER da próxima
-- migration, que fazem toda a checagem de elegibilidade/janela/limite.
create policy assessment_attempts_select_own
  on public.assessment_attempts for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy assessment_attempts_select_staff
  on public.assessment_attempts for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

-- Snapshot: o próprio aluno lê a própria tentativa (a UI de prova/
-- resultado é quem decide, no código, se mostra a resposta correta antes
-- da liberação do gabarito — a linha por si só não distingue isso, então
-- as Server Actions nunca repassam correct_option_ids_snapshot ao
-- cliente antes da liberação). Staff lê tudo para fins de auditoria.
create policy assessment_attempt_questions_select_own
  on public.assessment_attempt_questions for select to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = attempt_id and e.student_id = auth.uid()
  ));

create policy assessment_attempt_questions_select_staff
  on public.assessment_attempt_questions for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

-- Elegibilidade: staff lê tudo; aluno só a própria linha (transparência).
create policy assessment_eligible_students_select_own
  on public.assessment_eligible_students for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid()
  ));

create policy assessment_eligible_students_select_staff
  on public.assessment_eligible_students for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
