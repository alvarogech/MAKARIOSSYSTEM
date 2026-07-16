-- Conteúdo. `volume_id` é denormalizado (em vez de exigir um join
-- lesson→module→volume a cada leitura/policy) e mantido consistente por
-- trigger — mesmo padrão já usado em `enrollments` na Fase 2
-- (enforce_enrollment_class_offering).

create type public.content_type as enum ('video', 'file', 'text', 'link');

-- Classificação única cobrindo tanto o propósito pedagógico quanto a
-- restrição de audiência (doc 02 §3.7) — evita duas fontes de verdade
-- (um campo "obrigatório" e outro "público" que pudessem divergir).
create type public.content_classification as enum (
  'obrigatorio',
  'complementar',
  'preparatorio',
  'aprofundamento',
  'revisao',
  'exclusivo_professor',
  'exclusivo_coordenacao',
  'exclusivo_administracao'
);

create type public.content_status as enum ('draft', 'published', 'archived');

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  volume_id uuid not null references public.volumes (id) on delete restrict,
  title text not null,
  description text,
  type public.content_type not null,
  classification public.content_classification not null default 'complementar',
  estimated_minutes integer,
  order_index integer not null,
  status public.content_status not null default 'draft',
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contents_lesson_order_unique unique (lesson_id, order_index)
);

comment on table public.contents is
  'Conteúdo dentro de uma aula. classification=obrigatorio é o que a '
  'camada de serviço trata como bloqueante de progresso — conteúdo '
  'complementar nunca bloqueia (critério de aceitação da Fase 3).';

create trigger contents_set_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();

create or replace function public.enforce_content_volume_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_volume_id uuid;
begin
  select m.volume_id
  into v_expected_volume_id
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = new.lesson_id;

  if v_expected_volume_id is null or v_expected_volume_id <> new.volume_id then
    raise exception
      'contents.volume_id (%) não corresponde ao volume da aula/módulo (%) para lesson_id %.',
      new.volume_id, v_expected_volume_id, new.lesson_id;
  end if;

  return new;
end;
$$;

create trigger contents_enforce_volume_consistency
  before insert or update of lesson_id, volume_id on public.contents
  for each row execute function public.enforce_content_volume_consistency();

-- Conteúdo publicado/substituído é ação auditada (doc 02 §15).
create trigger contents_audit
  after insert or update or delete on public.contents
  for each row execute function private.log_audit_event();

create table public.video_contents (
  content_id uuid primary key references public.contents (id) on delete cascade,
  youtube_video_id text not null,
  min_percent integer not null default 80,
  duration_seconds integer,
  thumbnail_url text,
  constraint video_contents_min_percent_range check (min_percent between 1 and 100)
);

comment on table public.video_contents is
  'Vídeo do YouTube não listado (doc 02 §4). O ID nunca é exibido de '
  'forma destacada na UI — a página da aula só usa o ID para montar o '
  'player embutido, para um usuário já autorizado.';

-- Simplificação da Fase 3: URL direta (colada por quem cadastra), sem
-- upload real — Supabase Storage só entra a partir de quando um bucket
-- de materiais for provisionado (mesma decisão já tomada para a
-- importação de planilhas na Fase 2).
create table public.content_files (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  file_name text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- Verdadeiro se o usuário autenticado tem matrícula ativa/em regularização/
-- aprovada em ALGUMA oferta do volume informado — usado pelas policies de
-- leitura de conteúdo do aluno (não fica restrito a uma temporada
-- específica, já que o catálogo de conteúdo é por volume).
create or replace function public.has_active_enrollment_in_volume(p_volume_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.season_volume_offerings o on o.id = e.season_volume_offering_id
    where e.student_id = auth.uid()
      and o.volume_id = p_volume_id
      and e.status in ('active', 'regularization', 'approved')
  );
$$;

alter table public.contents enable row level security;
alter table public.video_contents enable row level security;
alter table public.content_files enable row level security;

-- Equipe de conteúdo vê tudo (inclusive rascunho/arquivado), para poder
-- revisar e pré-visualizar antes de publicar.
create policy contents_select_staff
  on public.contents for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- Professor: só conteúdo publicado, e nunca o que é exclusivo de
-- coordenação/administração.
create policy contents_select_teacher
  on public.contents for select to authenticated
  using (
    public.has_role('teacher')
    and status = 'published'
    and classification not in ('exclusivo_coordenacao', 'exclusivo_administracao')
  );

-- Aluno: só conteúdo publicado, não exclusivo de staff, e só do volume em
-- que tem matrícula autorizada — a base do critério "aluno só vê
-- conteúdo de matrícula autorizada".
create policy contents_select_student
  on public.contents for select to authenticated
  using (
    public.has_role('student')
    and status = 'published'
    and classification not in ('exclusivo_professor', 'exclusivo_coordenacao', 'exclusivo_administracao')
    and public.has_active_enrollment_in_volume(volume_id)
  );

create policy contents_write_content_staff
  on public.contents for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

-- video_contents/content_files seguem exatamente a mesma visibilidade do
-- conteúdo pai — reaproveita `contents_select_*` via EXISTS.
create policy video_contents_select_if_content_visible
  on public.video_contents for select to authenticated
  using (exists (select 1 from public.contents c where c.id = content_id));

create policy video_contents_write_content_staff
  on public.video_contents for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));

create policy content_files_select_if_content_visible
  on public.content_files for select to authenticated
  using (exists (select 1 from public.contents c where c.id = content_id));

create policy content_files_write_content_staff
  on public.content_files for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'))
  with check (public.has_role('coordinator') or public.has_role('admin') or public.has_role('content_editor'));
