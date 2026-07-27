-- Extensão pedida pela coordenação: carga horária por matéria (módulo) e
-- vínculo de professor por matéria específica dentro de uma turma — um
-- terceiro escopo, além dos dois já existentes em teacher_assignments
-- (turma inteira / encontro específico). Ver PLANO_TECNICO.md seção 4/8
-- para o desenho original desses dois escopos.

alter table public.modules
  add column academic_hours numeric(4, 1);

comment on column public.modules.academic_hours is
  'Carga horária da matéria/módulo, em horas-aula (ex.: 1, 2). Informativa '
  '— não confundir com class_meetings.academic_minutes, que é a carga real '
  'de um encontro presencial específico de uma turma.';

alter table public.teacher_assignments
  add column module_id uuid references public.modules (id) on delete cascade;

comment on column public.teacher_assignments.module_id is
  'Terceiro escopo possível do vínculo do professor: uma matéria (módulo) '
  'específica dentro da turma, sem estar preso a um encontro específico. '
  'Mutuamente exclusivo com meeting_id — ver teacher_assignments_scope_mutually_exclusive.';

alter table public.teacher_assignments
  add constraint teacher_assignments_scope_mutually_exclusive
  check (not (meeting_id is not null and module_id is not null));

-- Defesa em profundidade, mesmo padrão de enforce_content_volume_consistency
-- (Fase 3): a matéria vinculada precisa pertencer ao mesmo volume da oferta
-- da turma — nunca a matéria de outro volume.
create or replace function public.enforce_teacher_assignment_module_volume()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_volume_id uuid;
  v_module_volume_id uuid;
begin
  if new.module_id is null then
    return new;
  end if;

  select o.volume_id into v_class_volume_id
  from public.classes c
  join public.season_volume_offerings o on o.id = c.season_volume_offering_id
  where c.id = new.class_id;

  select volume_id into v_module_volume_id
  from public.modules where id = new.module_id;

  if v_class_volume_id is null or v_module_volume_id is null or v_class_volume_id <> v_module_volume_id then
    raise exception
      'A matéria % não pertence ao volume da turma % (oferta %).',
      new.module_id, new.class_id, v_class_volume_id;
  end if;

  return new;
end;
$$;

create trigger teacher_assignments_enforce_module_volume
  before insert or update of class_id, module_id on public.teacher_assignments
  for each row execute function public.enforce_teacher_assignment_module_volume();

-- Os dois índices de unicidade originais (Fase 2) tratavam "meeting_id is
-- null" como sinônimo de "turma inteira" — agora isso também cobre o novo
-- escopo de matéria, então o índice de "turma inteira" precisa exigir
-- explicitamente module_id is null também. Recriado (não dá para ALTER a
-- cláusula WHERE de um índice existente).
drop index if exists public.teacher_assignments_class_wide_unique;

create unique index teacher_assignments_class_wide_unique
  on public.teacher_assignments (teacher_id, class_id)
  where meeting_id is null and module_id is null;

create unique index teacher_assignments_module_specific_unique
  on public.teacher_assignments (teacher_id, class_id, module_id)
  where module_id is not null;
