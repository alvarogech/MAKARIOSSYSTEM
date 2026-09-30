-- Escala por aula/bloco + locais reutilizáveis + avisos da coordenação.
--
-- Contexto: até aqui, `teacher_assignments` só sabia dizer "este professor
-- tem algum vínculo com esta turma/matéria/encontro" — sem hora de início,
-- hora de término nem tema por ocorrência. Isso impedia distinguir "vínculo
-- à turma" de "escala efetiva": um professor vinculado a duas turmas cujo
-- `class_template` cai no mesmo horário (ex.: Essência e Caminho, ambas aos
-- sábados 08h-12h30) aparentava conflito de agenda mesmo quando, na
-- prática, cada vínculo cobre uma matéria (bloco de ~1h) em horários
-- diferentes dentro do mesmo encontro.
--
-- `class_meeting_blocks` é o novo conceito de "aula": um recorte de tempo
-- dentro de um `class_meeting` (encontro), com tema (module_id) e professor
-- responsável próprios. Um encontro pode ter vários blocos, com professores
-- diferentes. `teacher_assignments` continua sendo a fonte de verdade do
-- vínculo/permissão (não é substituída); `class_meeting_blocks` é a agenda
-- operacional concreta usada para "próxima aula" e detecção de conflito.
--
-- Nada é destrutivo: nenhuma coluna/tabela existente é removida ou tem seu
-- sentido alterado. `classes.location`/`class_meetings.location` (texto
-- livre) continuam existindo e sendo o fallback quando não há
-- `location_id`.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  entry_instructions text,
  parking_instructions text,
  arrival_minutes_before integer,
  coordination_contact text,
  resources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.locations is
  'Cadastro reutilizável de locais/espaços — endereço, sala fica em '
  'class_meetings.room / class_meeting_blocks.room (mais volátil que o '
  'espaço em si), orientações de entrada/estacionamento e recursos '
  'disponíveis (projetor, tv, som...). Endereço puro + link de mapa, sem '
  'mapa incorporado nem chave de API nova (ver src/lib/maps.ts).';

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- `location_id` é aditivo: quando nulo, a UI cai para o texto livre já
-- existente (`location`). `room` é novo em ambas — sala/ambiente dentro do
-- espaço, que pode mudar de encontro para encontro mesmo com o mesmo local.
alter table public.classes
  add column location_id uuid references public.locations (id) on delete set null;

alter table public.class_meetings
  add column location_id uuid references public.locations (id) on delete set null,
  add column room text;

create type public.meeting_block_status as enum ('scheduled', 'changed', 'canceled');

create table public.class_meeting_blocks (
  id uuid primary key default gen_random_uuid(),
  class_meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  teacher_id uuid references auth.users (id) on delete set null,
  start_time time,
  end_time time,
  room text,
  order_index integer not null default 1,
  status public.meeting_block_status not null default 'scheduled',
  coordination_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_meeting_blocks_order_unique unique (class_meeting_id, order_index),
  constraint class_meeting_blocks_time_order check (
    start_time is null or end_time is null or start_time < end_time
  )
);

comment on table public.class_meeting_blocks is
  '"Aula" no sentido da experiência do professor: um recorte de tempo dentro '
  'de um encontro (class_meeting), com tema (module_id) e professor '
  '(teacher_id) próprios. Enquanto um encontro não tiver nenhum bloco '
  'cadastrado, a UI deve apresentá-lo como "encontro da turma — escala '
  'ainda não definida", nunca inferir tema/professor a partir de '
  'teacher_assignments (que é vínculo, não escala).';

create trigger class_meeting_blocks_set_updated_at
  before update on public.class_meeting_blocks
  for each row execute function public.set_updated_at();

create index class_meeting_blocks_meeting_idx on public.class_meeting_blocks (class_meeting_id);
create index class_meeting_blocks_teacher_idx on public.class_meeting_blocks (teacher_id);

-- Avisos simples da coordenação para turmas/módulos. `class_id`/`module_id`
-- nulos = aviso geral (aparece para todo professor). Preenchidos = aviso
-- só para quem tem vínculo com aquela turma/matéria.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  class_id uuid references public.classes (id) on delete cascade,
  module_id uuid references public.modules (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.announcements is
  'Aviso da coordenação para professores. class_id/module_id nulos = geral. '
  'Não existe rascunho/agendamento nesta primeira versão — todo registro já '
  'nasce publicado (published_at = created_at).';

create index announcements_class_idx on public.announcements (class_id);
create index announcements_module_idx on public.announcements (module_id);

alter table public.locations enable row level security;
alter table public.class_meeting_blocks enable row level security;
alter table public.announcements enable row level security;

-- Locais: mesmo padrão de classes/class_meetings — não é dado sensível,
-- leitura liberada para autenticado, escrita só coordenação/admin.
create policy locations_select_authenticated
  on public.locations for select to authenticated using (true);

create policy locations_write_coordinator_admin
  on public.locations for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

-- Blocos: quem leciona aquele bloco especificamente, quem tem qualquer
-- vínculo (teacher_assignments) com a turma do encontro (para ver o dia
-- inteiro, não só o próprio recorte) e coordenação/admin. Escrita só
-- coordenação/admin — a escala é dado oficial, não autoatribuível.
create policy class_meeting_blocks_select_teacher
  on public.class_meeting_blocks for select to authenticated
  using (
    teacher_id = auth.uid()
    or exists (
      select 1
      from public.class_meetings cm
      join public.teacher_assignments ta on ta.class_id = cm.class_id
      where cm.id = class_meeting_blocks.class_meeting_id
        and ta.teacher_id = auth.uid()
    )
  );

create policy class_meeting_blocks_select_coordinator_admin
  on public.class_meeting_blocks for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));

create policy class_meeting_blocks_write_coordinator_admin
  on public.class_meeting_blocks for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create trigger class_meeting_blocks_audit
  after insert or update or delete on public.class_meeting_blocks
  for each row execute function private.log_audit_event();

-- Avisos: mesmo padrão de classes — não é dado sensível (é literalmente
-- feito para ser lido), leitura liberada para autenticado, escrita só
-- coordenação/admin. Filtragem por turma/módulo do professor é feita na
-- query (não em RLS), igual ao padrão já usado em contents/module.
create policy announcements_select_authenticated
  on public.announcements for select to authenticated using (true);

create policy announcements_write_coordinator_admin
  on public.announcements for all to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'))
  with check (public.has_role('coordinator') or public.has_role('admin'));

create trigger announcements_audit
  after insert or update or delete on public.announcements
  for each row execute function private.log_audit_event();
