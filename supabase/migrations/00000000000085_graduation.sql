-- Central de Formatura.
--
-- A ELEGIBILIDADE ACADEMICA nao e guardada: ela e calculada a cada consulta a
-- partir de matriculas, frequencia e avaliacoes (src/modules/graduation/eligibility.ts).
-- O que se guarda aqui e o que a plataforma nao tinha e nao pode ser recalculado:
--   - a EDICAO da formatura e a cerimonia (data, local, prazo);
--   - quem PARTICIPA de cada edicao (convite, confirmacao, comparecimento);
--   - o ACOMPANHAMENTO das pendencias e o historico de contatos;
--   - o HISTORICO ACADEMICO VALIDADO (conclusoes anteriores a plataforma);
--   - a AUDITORIA de tudo isso.
-- Nada aqui altera enrollments, assessments ou attendance_*.

-- ---------------------------------------------------------------- edicoes
create table if not exists public.graduation_editions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  season_id uuid not null references public.seasons (id) on delete restrict,
  -- Estado da ORGANIZACAO da formatura (nao do aluno).
  status text not null default 'em_preparacao'
    check (status in ('em_preparacao', 'regularizacao', 'confirmacoes_abertas', 'confirmacoes_encerradas', 'realizada', 'arquivada')),
  -- Cerimonia. Tudo opcional ate a publicacao: nao se mostra data inventada ao aluno.
  event_name text check (event_name is null or char_length(event_name) between 3 and 160),
  event_date date,
  event_time time,
  location_name text check (location_name is null or char_length(location_name) <= 160),
  address text check (address is null or char_length(address) <= 300),
  instructions text check (instructions is null or char_length(instructions) <= 2000),
  rsvp_deadline timestamptz,
  invite_message text check (invite_message is null or char_length(invite_message) <= 1000),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint graduation_editions_unique_name unique (season_id, name)
);

-- ------------------------------------------------------------ participantes
create table if not exists public.graduation_participants (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.graduation_editions (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  added_by uuid references auth.users (id) on delete set null,
  added_reason text not null default 'candidato_voz' check (added_reason in ('candidato_voz', 'historico_anterior', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Convite: so a coordenacao convida, e so quem estava APTO naquele momento.
  invited_at timestamptz,
  invited_by uuid references auth.users (id) on delete set null,
  invited_status text check (invited_status is null or invited_status = 'apto'),
  -- Confirmacao de presenca (antecipada). NAO e comparecimento.
  response text not null default 'sem_resposta' check (response in ('sem_resposta', 'confirmado', 'nao_comparece')),
  responded_at timestamptz,
  response_source text check (response_source is null or response_source in ('aluno', 'coordenacao')),
  response_channel text check (response_channel is null or response_channel in ('plataforma', 'whatsapp', 'presencial', 'telefone', 'outro')),
  response_recorded_by uuid references auth.users (id) on delete set null,
  -- Comparecimento real no dia.
  ceremony_attendance text not null default 'nao_registrado' check (ceremony_attendance in ('nao_registrado', 'compareceu', 'nao_compareceu')),
  attendance_recorded_at timestamptz,
  attendance_recorded_by uuid references auth.users (id) on delete set null,
  -- Nome que sera impresso no certificado (conferido pela coordenacao).
  certificate_name text check (certificate_name is null or char_length(certificate_name) between 3 and 160),
  certificate_name_checked_at timestamptz,
  certificate_name_checked_by uuid references auth.users (id) on delete set null,
  constraint graduation_participants_unique unique (edition_id, student_id),
  constraint graduation_participants_response_consistent
    check ((response = 'sem_resposta') = (responded_at is null))
);
create index if not exists graduation_participants_edition on public.graduation_participants (edition_id, response);
create index if not exists graduation_participants_student on public.graduation_participants (student_id);

-- ------------------------------------------------------------ acompanhamento
-- Estado OPERACIONAL do contato. Nao substitui nem altera a situacao academica.
-- `requirement_key = 'geral'` e o acompanhamento do aluno como um todo; as demais
-- chaves ('voz:avaliacao', 'caminho:conclusao'...) acompanham cada pendencia.
create table if not exists public.graduation_follow_ups (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.graduation_editions (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  requirement_key text not null default 'geral' check (char_length(requirement_key) between 3 and 80),
  contact_status text not null default 'nao_contatado'
    check (contact_status in ('nao_contatado', 'contato_realizado', 'aguardando_aluno', 'aguardando_coordenacao', 'aguardando_atualizacao_academica', 'regularizacao_concluida', 'encerrado_sem_regularizacao')),
  responsible_id uuid references public.profiles (id) on delete set null,
  next_step text check (next_step is null or char_length(next_step) <= 500),
  due_date date,
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint graduation_follow_ups_unique unique (edition_id, student_id, requirement_key)
);
create index if not exists graduation_follow_ups_edition on public.graduation_follow_ups (edition_id, contact_status);
create index if not exists graduation_follow_ups_responsible on public.graduation_follow_ups (responsible_id) where responsible_id is not null;

-- Historico de contatos: so cresce. Cada contato fica, mesmo depois de regularizado.
create table if not exists public.graduation_contacts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.graduation_editions (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  requirement_key text,
  channel text not null check (channel in ('whatsapp', 'telefone', 'presencial', 'email', 'outro')),
  contacted_at timestamptz not null default now(),
  contacted_by uuid references auth.users (id) on delete set null,
  summary text check (summary is null or char_length(summary) <= 1000),
  response text check (response is null or char_length(response) <= 1000),
  next_step text check (next_step is null or char_length(next_step) <= 500),
  due_date date,
  message_text text check (message_text is null or char_length(message_text) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists graduation_contacts_student on public.graduation_contacts (edition_id, student_id, contacted_at desc);

-- ------------------------------------------------------- historico validado
-- Conclusao de modulo anterior a plataforma, reconhecida por um administrador
-- com origem e evidencia. Nunca e apagada: revogar preenche revoked_*.
create table if not exists public.graduation_history_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  volume_slug text not null check (volume_slug in ('essencia', 'caminho', 'voz')),
  season_label text check (season_label is null or char_length(season_label) <= 60),
  origin text not null check (char_length(origin) between 3 and 300),
  evidence text not null check (char_length(evidence) between 5 and 2000),
  validated_by uuid not null references auth.users (id) on delete restrict,
  validated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 500),
  constraint graduation_history_revoked_consistent
    check ((revoked_at is null) = (revoked_by is null) and (revoked_at is null) = (revoke_reason is null))
);
-- No maximo um reconhecimento vigente por aluno e modulo.
create unique index if not exists graduation_history_active
  on public.graduation_history_records (student_id, volume_slug) where revoked_at is null;
create index if not exists graduation_history_student on public.graduation_history_records (student_id);

-- ---------------------------------------------------------------- auditoria
create table if not exists public.graduation_audit (
  id bigint generated always as identity primary key,
  edition_id uuid references public.graduation_editions (id) on delete restrict,
  student_id uuid references public.profiles (id) on delete restrict,
  action text not null check (char_length(action) between 3 and 80),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists graduation_audit_edition on public.graduation_audit (edition_id, created_at desc);

-- ------------------------------------------------------------------ gatilhos
drop trigger if exists graduation_editions_updated_at on public.graduation_editions;
create trigger graduation_editions_updated_at before update on public.graduation_editions
  for each row execute function public.set_updated_at();
drop trigger if exists graduation_participants_updated_at on public.graduation_participants;
create trigger graduation_participants_updated_at before update on public.graduation_participants
  for each row execute function public.set_updated_at();
drop trigger if exists graduation_follow_ups_updated_at on public.graduation_follow_ups;
create trigger graduation_follow_ups_updated_at before update on public.graduation_follow_ups
  for each row execute function public.set_updated_at();

-- Toda alteracao relevante da edicao/cerimonia deixa rastro, feita por quem for.
create or replace function public.graduation_audit_edition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  foreach v_field in array array['name', 'status', 'event_name', 'event_date', 'event_time', 'location_name', 'address', 'instructions', 'rsvp_deadline', 'invite_message', 'published_at']
  loop
    if v_old -> v_field is distinct from v_new -> v_field then
      v_changes := v_changes || jsonb_build_object(v_field, jsonb_build_object('de', v_old -> v_field, 'para', v_new -> v_field));
    end if;
  end loop;
  if v_changes <> '{}'::jsonb then
    insert into public.graduation_audit (edition_id, action, detail, actor_id)
    values (new.id, 'edicao_alterada', v_changes, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists graduation_editions_audit on public.graduation_editions;
create trigger graduation_editions_audit after update on public.graduation_editions
  for each row execute function public.graduation_audit_edition();

-- Convites, confirmacoes e comparecimento tambem: o historico de respostas nao se perde.
create or replace function public.graduation_audit_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.graduation_audit (edition_id, student_id, action, detail, actor_id)
    values (new.edition_id, new.student_id, 'participante_incluido', jsonb_build_object('motivo', new.added_reason), auth.uid());
    return new;
  end if;
  if old.invited_at is distinct from new.invited_at then
    insert into public.graduation_audit (edition_id, student_id, action, detail, actor_id)
    values (new.edition_id, new.student_id, case when new.invited_at is null then 'convite_retirado' else 'convite_enviado' end,
            jsonb_build_object('situacao', new.invited_status), auth.uid());
  end if;
  if old.response is distinct from new.response then
    insert into public.graduation_audit (edition_id, student_id, action, detail, actor_id)
    values (new.edition_id, new.student_id, 'resposta_registrada',
            jsonb_build_object('de', old.response, 'para', new.response, 'origem', new.response_source, 'canal', new.response_channel), auth.uid());
  end if;
  if old.ceremony_attendance is distinct from new.ceremony_attendance then
    insert into public.graduation_audit (edition_id, student_id, action, detail, actor_id)
    values (new.edition_id, new.student_id, 'comparecimento_registrado',
            jsonb_build_object('de', old.ceremony_attendance, 'para', new.ceremony_attendance), auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists graduation_participants_audit on public.graduation_participants;
create trigger graduation_participants_audit after insert or update on public.graduation_participants
  for each row execute function public.graduation_audit_participant();

-- Historico validado: quem validou e quem revogou ficam na auditoria.
create or replace function public.graduation_audit_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.graduation_audit (student_id, action, detail, actor_id)
    values (new.student_id, 'historico_validado',
            jsonb_build_object('modulo', new.volume_slug, 'temporada', new.season_label, 'origem', new.origin), auth.uid());
  elsif old.revoked_at is null and new.revoked_at is not null then
    insert into public.graduation_audit (student_id, action, detail, actor_id)
    values (new.student_id, 'historico_revogado', jsonb_build_object('modulo', new.volume_slug, 'motivo', new.revoke_reason), auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists graduation_history_audit on public.graduation_history_records;
create trigger graduation_history_audit after insert or update on public.graduation_history_records
  for each row execute function public.graduation_audit_history();

-- O registro de validacao e imutavel: so a revogacao pode ser preenchida.
create or replace function public.graduation_history_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.student_id, old.volume_slug, old.season_label, old.origin, old.evidence, old.validated_by, old.validated_at)
     is distinct from (new.student_id, new.volume_slug, new.season_label, new.origin, new.evidence, new.validated_by, new.validated_at) then
    raise exception 'O registro de histórico validado não pode ser editado; revogue e registre de novo.';
  end if;
  if old.revoked_at is not null then
    raise exception 'Este reconhecimento já foi revogado.';
  end if;
  return new;
end;
$$;
drop trigger if exists graduation_history_immutable on public.graduation_history_records;
create trigger graduation_history_immutable before update on public.graduation_history_records
  for each row execute function public.graduation_history_immutable();

-- ---------------------------------------------------- resposta do proprio aluno
-- O aluno nunca escreve na tabela: responde por esta funcao, que valida convite,
-- publicacao, prazo e dono. Responder de novo atualiza a MESMA linha (sem duplicar)
-- e nao toca em nenhum dado academico.
create or replace function public.graduation_respond(p_edition_id uuid, p_response text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition public.graduation_editions%rowtype;
  v_participant public.graduation_participants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;
  if p_response not in ('confirmado', 'nao_comparece') then
    raise exception 'Resposta inválida.';
  end if;

  select * into v_participant
  from public.graduation_participants
  where edition_id = p_edition_id and student_id = auth.uid()
  for update;
  if not found or v_participant.invited_at is null then
    raise exception 'Você não tem convite para esta formatura.';
  end if;

  select * into v_edition from public.graduation_editions where id = p_edition_id;
  if v_edition.published_at is null or v_edition.status <> 'confirmacoes_abertas' then
    raise exception 'As confirmações desta formatura não estão abertas.';
  end if;
  if v_edition.rsvp_deadline is not null and now() > v_edition.rsvp_deadline then
    raise exception 'O prazo para confirmar já terminou. Fale com a coordenação.';
  end if;

  if v_participant.response is distinct from p_response then
    update public.graduation_participants
    set response = p_response, responded_at = now(), response_source = 'aluno',
        response_channel = 'plataforma', response_recorded_by = auth.uid()
    where id = v_participant.id;
  end if;

  return jsonb_build_object('response', p_response);
end;
$$;
revoke all on function public.graduation_respond(uuid, text) from public;
revoke all on function public.graduation_respond(uuid, text) from anon;
grant execute on function public.graduation_respond(uuid, text) to authenticated;

-- ---------------------------------------------------------------------- RLS
alter table public.graduation_editions enable row level security;
alter table public.graduation_participants enable row level security;
alter table public.graduation_follow_ups enable row level security;
alter table public.graduation_contacts enable row level security;
alter table public.graduation_history_records enable row level security;
alter table public.graduation_audit enable row level security;

revoke all on public.graduation_editions, public.graduation_participants, public.graduation_follow_ups,
  public.graduation_contacts, public.graduation_history_records, public.graduation_audit from anon, authenticated;
grant select, insert, update on public.graduation_editions, public.graduation_participants, public.graduation_follow_ups to authenticated;
grant select, insert on public.graduation_contacts, public.graduation_audit to authenticated;
grant select, insert, update on public.graduation_history_records to authenticated;
grant usage, select on sequence public.graduation_audit_id_seq to authenticated;

-- Coordenacao e administrador: leem e escrevem (a regra fina por acao fica na camada de aplicacao).
do $$
declare t text;
begin
  foreach t in array array['graduation_editions', 'graduation_participants', 'graduation_follow_ups'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_role(''coordinator'') or public.has_role(''admin''))', t || '_staff_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(''coordinator'') or public.has_role(''admin''))', t || '_staff_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(''coordinator'') or public.has_role(''admin'')) with check (public.has_role(''coordinator'') or public.has_role(''admin''))', t || '_staff_update', t);
  end loop;
end $$;

drop policy if exists graduation_contacts_staff_select on public.graduation_contacts;
create policy graduation_contacts_staff_select on public.graduation_contacts for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
drop policy if exists graduation_contacts_staff_insert on public.graduation_contacts;
create policy graduation_contacts_staff_insert on public.graduation_contacts for insert to authenticated
  with check ((public.has_role('coordinator') or public.has_role('admin')) and contacted_by = auth.uid());

drop policy if exists graduation_audit_staff_select on public.graduation_audit;
create policy graduation_audit_staff_select on public.graduation_audit for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
drop policy if exists graduation_audit_staff_insert on public.graduation_audit;
create policy graduation_audit_staff_insert on public.graduation_audit for insert to authenticated
  with check ((public.has_role('coordinator') or public.has_role('admin')) and actor_id = auth.uid());

-- Historico validado: a coordenacao le; so o administrador valida e revoga.
drop policy if exists graduation_history_staff_select on public.graduation_history_records;
create policy graduation_history_staff_select on public.graduation_history_records for select to authenticated
  using (public.has_role('coordinator') or public.has_role('admin'));
drop policy if exists graduation_history_admin_insert on public.graduation_history_records;
create policy graduation_history_admin_insert on public.graduation_history_records for insert to authenticated
  with check (public.has_role('admin') and validated_by = auth.uid());
drop policy if exists graduation_history_admin_update on public.graduation_history_records;
create policy graduation_history_admin_update on public.graduation_history_records for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- O aluno enxerga apenas a propria participacao (e so depois do convite) e a edicao publicada a que foi convidado.
drop policy if exists graduation_participants_student_select on public.graduation_participants;
create policy graduation_participants_student_select on public.graduation_participants for select to authenticated
  using (student_id = auth.uid() and invited_at is not null);
drop policy if exists graduation_editions_student_select on public.graduation_editions;
create policy graduation_editions_student_select on public.graduation_editions for select to authenticated
  using (
    published_at is not null
    and exists (
      select 1 from public.graduation_participants p
      where p.edition_id = graduation_editions.id and p.student_id = auth.uid() and p.invited_at is not null
    )
  );

-- O aluno le o PROPRIO historico validado vigente (e so ele), para o resumo da jornada
-- dele refletir o que a coordenacao reconheceu. Nao enxerga revogados nem de outros.
drop policy if exists graduation_history_student_select_own on public.graduation_history_records;
create policy graduation_history_student_select_own on public.graduation_history_records for select to authenticated
  using (student_id = auth.uid() and revoked_at is null);
