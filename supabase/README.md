# Supabase — Fase 1

Este diretório contém apenas SQL versionado (`migrations/`) e o seed de
desenvolvimento (`seed.sql`). Não existe `config.toml` neste commit — ele é
gerado localmente pelo próprio Supabase CLI (não deve ser fabricado à mão) e
propositalmente não foi criado nesta sessão, que não tinha Docker/Supabase
CLI disponíveis para gerá-lo e validá-lo de verdade.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o
  Supabase local roda Postgres/Auth/Storage em contêineres)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

## Primeira configuração local

```bash
# 1. Gera supabase/config.toml (não sobrescreve migrations/ nem seed.sql)
supabase init

# 2. Sobe Postgres + Auth + Storage localmente
supabase start

# 3. Aplica todas as migrations em ordem + roda seed.sql
supabase db reset
```

`supabase start` imprime, ao final, a URL local da API, a `anon key`
(→ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.local`) e a
`service_role key` (→ `SUPABASE_SECRET_KEY`). Copie esses valores para
`.env.local` a partir de `.env.example`.

## Aplicar uma nova migration

```bash
supabase migration new nome_da_migration
# edite o arquivo gerado em supabase/migrations/
supabase db reset   # reaplica tudo do zero em dev, incluindo a nova migration
```

Nunca altere uma tabela apenas pelo Dashboard do Supabase — toda alteração
de schema precisa nascer como um arquivo em `supabase/migrations/`,
versionado no Git.

## Gerar os tipos TypeScript

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Rode este comando toda vez que uma migration alterar o schema. O arquivo
atual (`src/integrations/supabase/types.ts`) foi escrito manualmente como
placeholder mínimo e deve ser substituído pela primeira geração real.

## Resetar o banco local

```bash
supabase db reset
```

Derruba o banco local, reaplica todas as migrations em ordem e roda
`seed.sql` novamente — útil sempre que o schema local ficar inconsistente
ou antes de rodar os testes de integração.

## Pendência conhecida desta entrega

`seed.sql` insere usuários fictícios diretamente em `auth.users`/
`auth.identities`, seguindo o formato de colunas documentado pela
comunidade Supabase para seed local — mas **não foi executado nem validado
nesta sessão** (sem Docker disponível). Ao rodar `supabase db reset` pela
primeira vez, confira se todas as 7 contas de teste são criadas com sucesso
e ajuste as colunas se a versão do GoTrue instalada localmente exigir um
formato diferente.
