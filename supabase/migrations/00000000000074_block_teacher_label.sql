-- Professor que dá a aula mas não tem conta no sistema (ex.: convidados da temporada).
-- teacher_id continua sendo a vinculação "de verdade" (painel do professor, relatórios);
-- teacher_label só deixa o nome na escala para a coordenação não ver "sem professor".
alter table public.class_meeting_blocks
  add column if not exists teacher_label text
  check (teacher_label is null or char_length(teacher_label) between 2 and 120);

comment on column public.class_meeting_blocks.teacher_label is
  'Nome do professor sem conta no sistema. Quando a pessoa criar conta, defina teacher_id e limpe este campo.';
