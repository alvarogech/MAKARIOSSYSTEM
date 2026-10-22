-- Aviso importante: aparece em destaque (banner vermelho) no topo do início do aluno, e pode ter data para sair do ar.
-- Reversão: alter table public.announcements drop column is_urgent, drop column expires_at;
alter table public.announcements add column if not exists is_urgent boolean not null default false;
alter table public.announcements add column if not exists expires_at timestamptz;
