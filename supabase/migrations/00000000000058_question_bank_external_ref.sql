-- Referência externa estável para importação idempotente de conteúdo
-- preparado fora da plataforma (ex.: pacotes de questões revisados antes
-- da importação, como o piloto Caminho 2026-2). Nula para questões
-- criadas direto na Plataforma Makários. Re-rodar uma importação com o
-- mesmo external_ref deve atualizar a mesma questão, nunca duplicar.
alter table public.question_bank
  add column external_ref text unique;
