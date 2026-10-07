-- Matéria de cada faixa de horário dos encontros de uma turma, para quem pode ver a turma:
-- coordenação/admin, professor atribuído e o próprio aluno (matriculado ou com inscrição
-- aprovada para a turma). class_meeting_blocks sozinha só é legível por coordenação/professor.

create or replace function public.class_meeting_subjects(p_class_id uuid)
returns table (meeting_id uuid, start_time time, end_time time, subject text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.has_role('coordinator'::public.role_slug)
    or public.has_role('admin'::public.role_slug)
    or public.is_teacher_assigned_to_class(p_class_id)
    or exists (
      select 1 from public.enrollments e
      where e.class_id = p_class_id and e.student_id = auth.uid()
        and e.status in ('active', 'regularization', 'approved')
    )
  ) then
    return;
  end if;

  return query
  select b.class_meeting_id, b.start_time, b.end_time, m.name
  from public.class_meeting_blocks b
  join public.class_meetings cm on cm.id = b.class_meeting_id
  left join public.modules m on m.id = b.module_id
  where cm.class_id = p_class_id and b.status <> 'canceled'
  order by cm.meeting_date, b.start_time;
end;
$$;

revoke all on function public.class_meeting_subjects(uuid) from public, anon;
grant execute on function public.class_meeting_subjects(uuid) to authenticated;
