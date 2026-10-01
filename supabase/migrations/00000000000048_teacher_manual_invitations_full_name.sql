-- Faltou guardar o nome completo pretendido no convite manual: necessário
-- para "Gerar novo convite" (regenerar) reconstruir a mensagem de WhatsApp
-- sem pedir para a coordenação digitar tudo de novo.
alter table public.invitations
  add column intended_full_name text;
