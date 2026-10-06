-- Registro de quem já recebeu por e-mail o link do grupo de WhatsApp do volume.
-- Evita reenvio em duplicidade (envio em lote pela coordenação ou no e-mail de
-- "conta pronta") e deixa a coordenação ver quem ainda falta. Só o servidor grava.

create table public.volume_whatsapp_group_emails (
  student_id uuid not null references auth.users (id) on delete cascade,
  volume_id uuid not null references public.volumes (id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (student_id, volume_id)
);

alter table public.volume_whatsapp_group_emails enable row level security;

create policy volume_whatsapp_group_emails_select_coordinator_admin
  on public.volume_whatsapp_group_emails for select to authenticated
  using (has_role('coordinator'::role_slug) or has_role('admin'::role_slug));
