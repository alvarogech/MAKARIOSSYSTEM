-- Habilita Supabase Realtime (postgres_changes) para enrollment_requests,
-- usada pelo dashboard de acompanhamento de inscrições em
-- Coordenação > Inscrições. Realtime respeita a RLS já existente da
-- tabela (enrollment_requests_select_coordinator_admin) — um cliente
-- autenticado sem esse perfil não recebe eventos, mesmo inscrito no canal.
-- Não altera dados existentes, só a configuração de replicação lógica.

alter publication supabase_realtime add table public.enrollment_requests;
