-- Link do grupo de WhatsApp de cada volume, exibido na área do aluno matriculado.
-- Tabela própria (e não coluna em `volumes`) porque `volumes` é legível por qualquer
-- usuário logado — o convite do grupo só pode ser lido por quem cursa o volume.

create table public.volume_whatsapp_groups (
  volume_id uuid primary key references public.volumes (id) on delete cascade,
  invite_url text not null check (invite_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  updated_at timestamptz not null default now()
);

alter table public.volume_whatsapp_groups enable row level security;

create policy volume_whatsapp_groups_select_enrolled_student
  on public.volume_whatsapp_groups for select to authenticated
  using (has_role('student'::role_slug) and has_active_enrollment_in_volume(volume_id));

create policy volume_whatsapp_groups_select_staff
  on public.volume_whatsapp_groups for select to authenticated
  using (has_role('coordinator'::role_slug) or has_role('admin'::role_slug) or has_role('teacher'::role_slug));

create policy volume_whatsapp_groups_write_coordinator_admin
  on public.volume_whatsapp_groups for all to authenticated
  using (has_role('coordinator'::role_slug) or has_role('admin'::role_slug))
  with check (has_role('coordinator'::role_slug) or has_role('admin'::role_slug));

create trigger volume_whatsapp_groups_set_updated_at
  before update on public.volume_whatsapp_groups
  for each row execute function set_updated_at();

insert into public.volume_whatsapp_groups (volume_id, invite_url)
select v.id, g.url
from public.volumes v
join (values
  ('essencia', 'https://chat.whatsapp.com/KMR4Pt03MVk3QbmOGUFbVq'),
  ('caminho',  'https://chat.whatsapp.com/BRThzKvirNgEiXkXiMb3TU'),
  ('voz',      'https://chat.whatsapp.com/EvRHq1YG5IlBAZIJQD2ixf')
) as g(slug, url) on g.slug = v.slug;
