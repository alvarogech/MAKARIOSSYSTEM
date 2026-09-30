-- Bug real encontrado ao investigar a área do professor: não existia
-- NENHUMA policy de select em `enrollments` para o papel professor — só
-- "própria matrícula" (aluno) e coordenação/admin. Na prática, a contagem
-- de "Alunos (N)" em professor/turmas/[classId] sempre retornava vazio para
-- qualquer professor, indistinguível de "turma realmente sem matrícula"
-- (RLS filtra silenciosamente, não gera erro). Esta policy dá ao professor
-- exatamente o que ele precisa para contar/listar os alunos das turmas às
-- quais tem vínculo — nada além disso.

create policy enrollments_select_teacher
  on public.enrollments for select to authenticated
  using (
    exists (
      select 1
      from public.teacher_assignments ta
      where ta.class_id = enrollments.class_id
        and ta.teacher_id = auth.uid()
    )
  );
