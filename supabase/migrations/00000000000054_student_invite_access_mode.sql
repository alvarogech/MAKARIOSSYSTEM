-- A maioria dos alunos tem e-mail de contato exclusivo e pode logar com
-- e-mail + senha normalmente (como professor/coordenação). O código de
-- acesso (telefone sintético) só é necessário quando o e-mail já está — ou
-- vai ficar — em uso por outra conta (ex.: irmãos cadastrados com o e-mail
-- de um responsável). Essa coluna decide, por convite, qual dos dois
-- mecanismos `acceptStudentInvitation` usa.
alter table public.invitations
  add column use_access_code boolean not null default false;
