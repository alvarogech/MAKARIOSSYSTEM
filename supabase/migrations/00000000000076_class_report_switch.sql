-- Relatório pós-aula: interruptor por semestre (só o administrador altera) e regra de escrita no banco.
-- Reversão: ver bloco "DOWN" no fim do arquivo.

alter table public.seasons
  add column if not exists require_class_report boolean not null default false,
  add column if not exists require_class_report_changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists require_class_report_changed_at timestamptz;

comment on column public.seasons.require_class_report is
  'Quando false, o relatório pós-aula não aparece para os professores e não gera pendências. Só o administrador altera.';

-- Quem pode mudar o interruptor é decidido no banco (não só na tela): coordenação escreve em seasons,
-- mas esta coluna é exclusiva do administrador. Registra quem alterou e quando.
create or replace function private.guard_season_report_flag()
returns trigger
language plpgsql
as $$
begin
  if new.require_class_report is distinct from old.require_class_report then
    if auth.uid() is not null and not public.has_role('admin') then
      raise exception 'Somente o administrador pode alterar a exigência do relatório pós-aula.';
    end if;
    new.require_class_report_changed_by := auth.uid();
    new.require_class_report_changed_at := now();
  else
    -- Sem mudança no interruptor, os campos de auditoria não podem ser adulterados.
    new.require_class_report_changed_by := old.require_class_report_changed_by;
    new.require_class_report_changed_at := old.require_class_report_changed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists seasons_guard_report_flag on public.seasons;
create trigger seasons_guard_report_flag
  before update on public.seasons
  for each row execute function private.guard_season_report_flag();

-- Alunos sinalizados pelo professor (lista da turma) além da observação livre.
alter table public.class_meeting_reports
  add column if not exists attention_student_ids uuid[] not null default '{}';

-- Pode escrever relatório quem está ESCALADO naquele encontro, depois do término dele,
-- e só se o semestre exige o relatório. Relatórios já enviados continuam legíveis.
create or replace function public.can_write_class_report(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_meetings m
    join public.classes c on c.id = m.class_id
    join public.season_volume_offerings o on o.id = c.season_volume_offering_id
    join public.seasons s on s.id = o.season_id
    where m.id = p_meeting_id
      and s.require_class_report
      and m.meeting_date is not null
      and m.end_time is not null
      and ((m.meeting_date + m.end_time) at time zone 'America/Sao_Paulo') <= now()
      and exists (
        select 1 from public.class_meeting_blocks b
        where b.class_meeting_id = m.id
          and b.teacher_id = auth.uid()
          and b.status <> 'canceled'
      )
  );
$$;

drop policy if exists class_meeting_reports_write_own_teacher on public.class_meeting_reports;
create policy class_meeting_reports_write_own_teacher on public.class_meeting_reports
  for all to authenticated
  using (teacher_id = auth.uid() and public.can_write_class_report(meeting_id))
  with check (teacher_id = auth.uid() and public.can_write_class_report(meeting_id));

-- DOWN (manual):
--   drop policy class_meeting_reports_write_own_teacher on public.class_meeting_reports;
--   create policy class_meeting_reports_write_own_teacher on public.class_meeting_reports for all to authenticated
--     using (teacher_id = auth.uid() and public.is_teacher_assigned_to_class((select class_id from public.class_meetings where id = meeting_id)))
--     with check (teacher_id = auth.uid() and public.is_teacher_assigned_to_class((select class_id from public.class_meetings where id = meeting_id)));
--   drop function public.can_write_class_report(uuid);
--   alter table public.class_meeting_reports drop column attention_student_ids;
--   drop trigger seasons_guard_report_flag on public.seasons; drop function private.guard_season_report_flag();
--   alter table public.seasons drop column require_class_report, drop column require_class_report_changed_by, drop column require_class_report_changed_at;
