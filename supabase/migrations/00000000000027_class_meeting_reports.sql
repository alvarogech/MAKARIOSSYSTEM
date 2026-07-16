-- Relatório pós-aula (doc 04 PRO-07). "Chega à coordenação" é resolvido
-- por RLS: coordenação/admin sempre leem tudo, sem depender de nenhuma
-- notificação — a tela de coordenação consulta esta tabela diretamente.

create table public.class_meeting_reports (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete restrict,
  content_completed text,
  plan_changed boolean not null default false,
  plan_change_notes text,
  recurring_questions text,
  occurrences text,
  students_needing_attention text,
  observation text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_meeting_reports_meeting_teacher_unique unique (meeting_id, teacher_id)
);

create trigger class_meeting_reports_set_updated_at
  before update on public.class_meeting_reports
  for each row execute function public.set_updated_at();

alter table public.class_meeting_reports enable row level security;

create policy class_meeting_reports_select_own_teacher
  on public.class_meeting_reports for select to authenticated
  using (teacher_id = auth.uid());

create policy class_meeting_reports_select_coordinator_admin
  on public.class_meeting_reports for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy class_meeting_reports_write_own_teacher
  on public.class_meeting_reports for all to authenticated
  using (
    teacher_id = auth.uid()
    and public.is_teacher_assigned_to_class(
      (select class_id from public.class_meetings where id = meeting_id)
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_assigned_to_class(
      (select class_id from public.class_meetings where id = meeting_id)
    )
  );

create policy class_meeting_reports_write_coordinator_admin
  on public.class_meeting_reports for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));
