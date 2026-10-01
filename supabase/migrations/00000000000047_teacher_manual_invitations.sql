-- Primeiro acesso de professor por link manual (WhatsApp), sem depender de
-- e-mail. Estende `public.invitations` em vez de criar um modelo paralelo:
-- as colunas abaixo controlam o ciclo de vida do NOSSO link (pendente,
-- usado, expirado, revogado), um conceito deliberadamente separado de
-- `invitations.status`/`accepted_at` — que continuam sendo escritos
-- exclusivamente pelo trigger `handle_new_user` no momento em que a conta
-- do Supabase Auth é criada. Os dois ciclos de vida não se sobrepõem: o
-- link pode estar "usado" (consumed_at) no exato instante em que a conta é
-- criada e o trigger marca `status = accepted` — são o mesmo evento visto
-- por duas colunas com propósitos diferentes (uma rastreia nosso token, a
-- outra rastreia a concessão do papel).
--
-- Criação da conta no Supabase Auth continua LAZY (só no aceite, via
-- `admin.createUser`) — nunca no momento em que a coordenação gera o
-- convite. Isso evita contas "fantasma" para convites nunca concluídos e
-- mantém `invitations.status = 'pending'` útil para o trigger casar o
-- convite certo (o mais recente por `invited_at`) no momento em que a
-- conta finalmente é criada.

alter table public.invitations
  add column channel text not null default 'email'
    check (channel in ('email', 'manual_link')),
  add column purpose text
    check (purpose in ('teacher_onboarding', 'password_reset')),
  add column token_hash text,
  add column token_expires_at timestamptz,
  add column consumed_at timestamptz,
  add column revoked_at timestamptz,
  add column revoked_by uuid references auth.users (id) on delete set null,
  add column phone text,
  add column class_ids uuid[] not null default '{}';

comment on column public.invitations.channel is
  'email = fluxo original (Supabase Auth envia o e-mail). manual_link = '
  'convite com link/token próprio, entregue manualmente (WhatsApp), sem '
  'envio automático de e-mail.';
comment on column public.invitations.token_hash is
  'SHA-256 (hex) do token bruto. O token em si nunca é persistido — só o '
  'hash, para que um vazamento do banco não exponha links válidos.';
comment on column public.invitations.consumed_at is
  'Quando o convidado efetivamente concluiu o formulário (nome/whatsapp/'
  'senha) — nunca confundir com invitations.accepted_at, que é escrito pelo '
  'trigger handle_new_user no momento em que a conta é criada no Supabase '
  'Auth (pode ser o mesmo instante, mas são conceitos diferentes).';
comment on column public.invitations.class_ids is
  'Turmas que a coordenação pretende vincular ao aceitar o convite — '
  'materializadas em teacher_assignments só na conclusão, nunca antes '
  '(convite revogado ou nunca aceito não deixa vínculo acadêmico órfão).';

-- Um token só pode existir em uma linha (apesar de astronomicamente
-- improvável colidir, o índice é uma proteção barata).
create unique index invitations_token_hash_unique
  on public.invitations (token_hash)
  where token_hash is not null;

create index invitations_channel_email_idx
  on public.invitations (channel, email);

-- Busca de conta existente por e-mail (detecção de duplicidade — seção 4).
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

-- Separa "convite/concessão de papel" de "cadastro inicial concluído": o
-- professor pode validar o link e interromper antes de criar a senha.
-- Backfill com `created_at` garante que NINGUÉM com conta já existente
-- (professor ativo há meses, aluno, coordenação...) fique bloqueado por
-- um campo novo que não existia quando a conta foi criada.
alter table public.profiles
  add column onboarding_completed_at timestamptz;

update public.profiles
  set onboarding_completed_at = created_at
  where onboarding_completed_at is null;

comment on column public.profiles.onboarding_completed_at is
  'Quando o usuário concluiu o formulário de primeiro acesso (dados + '
  'senha). Contas migradas antes desta coluna existir foram backfilled com '
  'created_at — nunca ficam bloqueadas por um campo que não existia.';

-- Checagem pontual "este usuário tem este papel?", sem expor a lista
-- completa de papéis de terceiros (o que profiles/user_roles já restringem
-- por RLS). SECURITY DEFINER ignora RLS internamente, mas o próprio corpo
-- da função só responde de verdade para quem já poderia enxergar isso
-- (coordenação/admin, ou o próprio usuário) — do contrário, nega.
create or replace function public.user_has_role(
  target_user uuid,
  check_role public.role_slug
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when public.has_role('coordinator') or public.has_role('admin') or auth.uid() = target_user
    then exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = target_user and r.slug = check_role
    )
    else false
  end;
$$;

comment on function public.user_has_role(uuid, public.role_slug) is
  'Verdadeiro se target_user possui check_role — só responde para '
  'coordenação/admin ou para o próprio usuário consultando a si mesmo; '
  'qualquer outro chamador recebe false (fail closed), nunca um erro que '
  'entregaria informação pela mensagem.';

grant execute on function public.user_has_role(uuid, public.role_slug) to authenticated;

-- Concessão do papel "professor" a uma conta já existente (ex.: aluno que
-- também vai lecionar) é uma ação administrativa estreita: coordenação NÃO
-- ganha `user_roles:manage` geral (isso continua exclusivo de admin — ver
-- migration 10), só o direito de inserir especificamente o papel teacher.
-- A subquery resolve o id de 'teacher' em tempo de checagem, então mesmo
-- que o client mande outro role_id, a policy rejeita.
create policy user_roles_insert_teacher_provisioning
  on public.user_roles
  for insert
  to authenticated
  with check (
    (public.has_role('coordinator') or public.has_role('admin'))
    and role_id = (select id from public.roles where slug = 'teacher')
  );

-- Rate limiting simples para os endpoints públicos do convite manual
-- (consulta de token e tentativa de aceite) — não substitui proteção de
-- borda (Netlify/WAF), mas evita que uma chamada automatizada tente muitos
-- tokens em sequência. Sem policy de RLS: só a função SECURITY DEFINER
-- abaixo toca a tabela (mesmo padrão de private.audit_logs).
create table private.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_bucket_created_idx
  on private.rate_limit_hits (bucket_key, created_at);

create or replace function public.check_rate_limit(
  p_bucket text,
  p_max_hits int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_count int;
begin
  delete from private.rate_limit_hits
  where bucket_key = p_bucket
    and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
  from private.rate_limit_hits
  where bucket_key = p_bucket;

  if v_count >= p_max_hits then
    return false;
  end if;

  insert into private.rate_limit_hits (bucket_key) values (p_bucket);
  return true;
end;
$$;

comment on function public.check_rate_limit(text, int, int) is
  'Registra uma tentativa em p_bucket e devolve false se já atingiu '
  'p_max_hits dentro dos últimos p_window_seconds. Chamado a partir de '
  'rotas públicas (anon) antes de validar token de convite/recuperação.';

grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
