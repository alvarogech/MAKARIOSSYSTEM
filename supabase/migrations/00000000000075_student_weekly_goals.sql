-- Meta semanal opcional do aluno. Privada: só o próprio aluno lê e escreve (nem professor nem coordenação).
-- As conquistas NÃO têm tabela: são calculadas na leitura a partir de tentativas, respostas e práticas.
create table if not exists public.student_weekly_goals (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  target smallint not null default 2 check (target between 1 and 5),
  updated_at timestamptz not null default now()
);

alter table public.student_weekly_goals enable row level security;

create policy student_weekly_goals_select_own on public.student_weekly_goals
  for select to authenticated using (student_id = auth.uid());

create policy student_weekly_goals_insert_own on public.student_weekly_goals
  for insert to authenticated with check (student_id = auth.uid() and public.has_role('student'));

create policy student_weekly_goals_update_own on public.student_weekly_goals
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

comment on table public.student_weekly_goals is
  'Meta semanal opcional (1–5 atividades). Privada do aluno; desligada por padrão; sem histórico de falha.';
