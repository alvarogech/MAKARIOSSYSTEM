-- O convite manual (migration 47) só vinculava o professor à TURMA inteira
-- (teacher_assignments, "regente"). Mas o painel do professor só mostra uma
-- aula quando class_meeting_blocks.teacher_id aponta exatamente para ele —
-- então, sem isso, a pessoa aceitava o convite e não via nenhuma matéria.
-- Esta coluna guarda quais blocos específicos (aulas) são dela, para que
-- o aceite (ou a concessão direta de papel, quando a conta já existe)
-- preencha teacher_id automaticamente, sem passo manual depois.
alter table public.invitations
  add column meeting_block_ids uuid[] not null default '{}';
