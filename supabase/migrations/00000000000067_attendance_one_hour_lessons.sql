-- Aula passa a ser de 1 HORA (terça/quinta: 2 por encontro; sábado: 4). Até aqui as
-- presenças eram guardadas em unidades de 30 min (terça/quinta 4, sábado 8). Esta
-- migração converte o que já foi gravado, sem apagar nada, com a regra decidida pela
-- coordenação em 07/10/2026: o aluno ganha a aula de 1 hora se esteve presente em pelo
-- menos um dos dois slots de 30 min que a compõem (impacto conhecido: 10 registros do
-- sábado 03/10 passam de 90 para 120 min).
--
-- Idempotente: só converte linhas com unit_minutes = 30; depois marca como 60.

alter table public.attendance_scans
  add column if not exists unit_minutes smallint not null default 30;
alter table public.attendance_manual_entries
  add column if not exists unit_minutes smallint not null default 30;

-- 1. Escaneamentos / autodeclarações.
with conv as (
  select
    s.id,
    case
      when s.lesson_numbers is not null then
        coalesce((select array_agg(distinct ceil(u / 2.0)::int order by ceil(u / 2.0)::int) from unnest(s.lesson_numbers) as u), '{}'::int[])
      when s.lessons_credited = 0 then '{}'::int[]
      else (
        select array_agg(g)
        from generate_series(
          (case when s.block = 2 then ceil(s.lessons_total / 2.0)::int else 0 end) + ceil((s.lessons_total - s.lessons_credited + 1) / 2.0)::int,
          (case when s.block = 2 then ceil(s.lessons_total / 2.0)::int else 0 end) + ceil(s.lessons_total / 2.0)::int
        ) as g
      )
    end as hours,
    ceil(s.lessons_total / 2.0)::int as new_total
  from public.attendance_scans s
  where s.unit_minutes = 30
)
update public.attendance_scans s
set lesson_numbers = conv.hours::smallint[],
    lessons_total = conv.new_total,
    lessons_credited = cardinality(conv.hours),
    recognized_minutes = cardinality(conv.hours) * 60,
    unit_minutes = 60
from conv
where conv.id = s.id;

-- 2. Presença lançada à mão.
update public.attendance_manual_entries m
set lessons = (select array_agg(distinct ceil(u / 2.0)::smallint order by ceil(u / 2.0)::smallint) from unnest(m.lessons) as u),
    unit_minutes = 60
where m.unit_minutes = 30;

-- 3. Daqui para frente tudo é gravado em aulas de 1 hora.
alter table public.attendance_scans alter column unit_minutes set default 60;
alter table public.attendance_manual_entries alter column unit_minutes set default 60;
