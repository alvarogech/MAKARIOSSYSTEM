-- Chamada por QR em dois passos: o aluno le o QR, o sistema mostra as aulas do
-- dia (com horario e materia) e ele MARCA em quais esteve. O escaneamento passa
-- a guardar exatamente quais aulas foram marcadas, em vez de deduzir pelo horario
-- em que o QR foi lido (a regra de tolerancia gerou muitos erros no teste).
-- Linhas antigas (lesson_numbers nulo) continuam valendo pelo calculo antigo.

alter table public.attendance_scans
  add column if not exists lesson_numbers smallint[],
  add column if not exists self_declared boolean not null default false;

alter table public.attendance_scans drop constraint if exists attendance_scans_lesson_numbers_match;
alter table public.attendance_scans add constraint attendance_scans_lesson_numbers_match check (
  lesson_numbers is null or cardinality(lesson_numbers) = lessons_credited
);
