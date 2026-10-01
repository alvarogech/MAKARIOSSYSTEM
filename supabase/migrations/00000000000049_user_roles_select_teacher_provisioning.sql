-- A tela de gestão de professores (coordenação) precisa listar TODOS os
-- professores, inclusive os sem nenhuma turma ainda (user_roles é a única
-- fonte disso — teacher_assignments não tem linha pra quem não tem turma).
-- RLS de leitura de user_roles continua estreita: só a linha cujo papel é
-- 'teacher', nunca a lista completa de papéis de terceiros.
create policy user_roles_select_teacher_provisioning
  on public.user_roles
  for select
  to authenticated
  using (
    (public.has_role('coordinator') or public.has_role('admin'))
    and role_id = (select id from public.roles where slug = 'teacher')
  );
