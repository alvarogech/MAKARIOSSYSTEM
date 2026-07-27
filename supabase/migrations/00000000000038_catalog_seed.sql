-- Catálogo institucional fixo (não é dado de teste): os 3 volumes e os 2
-- modelos de turma da Escola Makários, com os valores exatos documentados
-- em makarios-docs/docs/08-dados-iniciais-temporada-2026-2.md §2/§4/§5.
--
-- Originalmente vivia em supabase/seed.sql (Fase 2), misturado com dados
-- fictícios de desenvolvimento. Como seed.sql nunca deve rodar contra um
-- projeto remoto/produção, esta migration isola só o catálogo real —
-- necessário para a coordenação conseguir criar a primeira temporada.

insert into public.volumes (slug, name, order_index, presencial_hours)
values
  ('essencia', 'Essência', 1, 16),
  ('caminho', 'Caminho', 2, 16),
  ('voz', 'Voz', 3, 16)
on conflict (slug) do nothing;

insert into public.volume_prerequisites (volume_id, prerequisite_volume_id)
select v_caminho.id, v_essencia.id
from public.volumes v_caminho, public.volumes v_essencia
where v_caminho.slug = 'caminho' and v_essencia.slug = 'essencia'
on conflict do nothing;

insert into public.volume_prerequisites (volume_id, prerequisite_volume_id)
select v_voz.id, v_caminho.id
from public.volumes v_voz, public.volumes v_caminho
where v_voz.slug = 'voz' and v_caminho.slug = 'caminho'
on conflict do nothing;

insert into public.class_templates (
  slug, name, weekdays, start_time, end_time, break_minutes,
  meetings_count, academic_minutes_per_meeting, total_academic_minutes
) values (
  'terca_quinta', 'Terça e quinta', array['tuesday', 'thursday'],
  '19:30', '21:50', 20,
  8, 120, 960
)
on conflict (slug) do nothing;

insert into public.class_templates (
  slug, name, weekdays, start_time, end_time, break_minutes,
  meetings_count, academic_minutes_per_meeting, total_academic_minutes
) values (
  'sabado', 'Sábado', array['saturday'],
  '08:00', '12:30', 30,
  4, 240, 960
)
on conflict (slug) do nothing;
