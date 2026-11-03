-- Pedido de ajuste feito pelo proprio aluno, ja logado (volume ou turma errada,
-- dados errados...). Usa a mesma fila da pagina publica /ajuda: a coordenacao
-- ve tudo em /coordenacao/ajuda. A diferenca e que aqui o servidor ja sabe quem
-- e o aluno (student_id), entao ele nao digita CPF nem WhatsApp, e pode dizer
-- para qual volume/horario quer ir, para a coordenacao so aplicar a troca.
alter table public.help_requests
  add column if not exists student_id uuid references auth.users (id) on delete set null,
  add column if not exists wanted_volume_slug text
    check (wanted_volume_slug is null or wanted_volume_slug in ('essencia', 'caminho', 'voz')),
  add column if not exists wanted_schedule_slug text
    check (wanted_schedule_slug is null or wanted_schedule_slug in ('terca_quinta', 'sabado'));

create index if not exists help_requests_student on public.help_requests (student_id, created_at desc)
  where student_id is not null;

-- O aluno enxerga so os pedidos dele (para acompanhar se ja foi resolvido).
-- A escrita continua so pelo servidor (service_role), como no /ajuda.
drop policy if exists help_requests_student_select_own on public.help_requests;
create policy help_requests_student_select_own
  on public.help_requests for select to authenticated
  using (student_id = auth.uid());
