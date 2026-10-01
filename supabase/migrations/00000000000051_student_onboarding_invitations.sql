-- Primeiro acesso de aluno por e-mail: mesma arquitetura de
-- invitations/token já usada para professores (migration 47), só que
-- com channel='email' (já permitido) e um novo purpose. Guardamos de
-- qual enrollment_request isto veio, para no aceite conseguir resolver a
-- turma (volume+horário) e criar a matrícula de fato — sem isso a tela
-- inicial do aluno ficaria vazia no primeiro login.
alter table public.invitations
  add column enrollment_request_id uuid references public.enrollment_requests(id);

alter table public.invitations
  drop constraint invitations_purpose_check;

alter table public.invitations
  add constraint invitations_purpose_check
  check (purpose = any (array['teacher_onboarding','password_reset','student_onboarding']));

-- Controle de lembrete (1 em ~3 dias, 1 final perto da aula) — fica na
-- própria linha de convite, sem tabela nova: cada convite de aluno só
-- tem um "próximo lembrete" por vez.
alter table public.invitations
  add column reminder_stage text not null default 'none'
    check (reminder_stage = any (array['none','first_sent','final_sent'])),
  add column last_sent_at timestamptz;
