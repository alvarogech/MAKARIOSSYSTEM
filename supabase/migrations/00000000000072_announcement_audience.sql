-- Avisos também para ALUNOS: cada aviso tem um público (professores, alunos ou todos).
-- Os avisos que já existem eram só para professores e continuam assim.
alter table public.announcements
  add column if not exists audience text not null default 'teachers'
  check (audience in ('teachers', 'students', 'all'));

-- Antes qualquer usuário logado lia todos os avisos; agora cada perfil lê só o que é para ele.
drop policy if exists announcements_select_authenticated on public.announcements;

create policy announcements_select_staff on public.announcements
  for select to authenticated
  using (public.has_role('coordinator'::public.role_slug) or public.has_role('admin'::public.role_slug));

create policy announcements_select_teacher on public.announcements
  for select to authenticated
  using (public.has_role('teacher'::public.role_slug) and audience in ('teachers', 'all'));

-- Aluno: aviso geral, da turma dele ou de um módulo do volume em que está matriculado.
create policy announcements_select_student on public.announcements
  for select to authenticated
  using (
    public.has_role('student'::public.role_slug)
    and audience in ('students', 'all')
    and (
      (class_id is null and module_id is null)
      or class_id in (
        select e.class_id from public.enrollments e
        where e.student_id = auth.uid() and e.status in ('active', 'regularization', 'approved')
      )
      or module_id in (
        select m.id
        from public.modules m
        join public.season_volume_offerings o on o.volume_id = m.volume_id
        join public.enrollments e on e.season_volume_offering_id = o.id
        where e.student_id = auth.uid() and e.status in ('active', 'regularization', 'approved')
      )
    )
  );
