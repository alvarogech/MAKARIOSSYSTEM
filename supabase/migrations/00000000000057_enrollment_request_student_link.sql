-- Liga a inscrição (enrollment_requests) à conta de verdade (auth.users)
-- quando a pessoa aceita o convite e cria a conta — hoje esse link não
-- existia, então o Dashboard de Inscrições não tinha como saber em qual
-- turma o aluno ficou matriculado nem oferecer mover de turma a partir
-- dali. Preenchido em acceptStudentInvitation no momento da aceitação.
alter table public.enrollment_requests
  add column student_id uuid references auth.users (id) on delete set null;
