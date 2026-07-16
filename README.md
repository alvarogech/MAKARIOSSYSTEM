# Plataforma Makários

Ambiente digital de apoio ao ensino e à gestão acadêmica da **Escola
Makários** (Igreja Emaús). Ver [`PLANO_TECNICO.md`](./PLANO_TECNICO.md)
para arquitetura, stack, modelo de dados e roadmap completos, e os
relatórios de cada fase entregue:
[`FASE_1_RELATORIO.md`](./FASE_1_RELATORIO.md) (Fundação),
[`FASE_2_RELATORIO.md`](./FASE_2_RELATORIO.md) (Administração acadêmica),
[`FASE_3_RELATORIO.md`](./FASE_3_RELATORIO.md) (Conteúdo e área do aluno),
[`FASE_4_RELATORIO.md`](./FASE_4_RELATORIO.md) (Área do professor).

**Status:** Fase 4 (Área do professor) entregue — aguardando validação
antes da Fase 5.

## Stack

Next.js (App Router, TypeScript) hospedado no Netlify · Supabase
(Postgres, Auth, Storage, RLS) · SMTP Titan · GitHub Actions.

## Pré-requisitos

- Node.js 20+ e npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

## Rodando localmente

```bash
npm install

# Supabase local — ver instruções completas em supabase/README.md
supabase init
supabase start
supabase db reset

# Copie .env.example para .env.local e preencha com a URL/keys impressas
# por `supabase start`
cp .env.example .env.local

npm run dev
```

Acesse `http://localhost:3000`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Next.js) |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build de produção localmente |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes unitários (Vitest, não dependem de banco) |
| `npm run test:integration` | Testes de RLS contra Supabase local (exige `supabase start`) |
| `npm run check:no-secret-in-bundle` | Confere, após `npm run build`, que a chave administrativa não vazou para o bundle do navegador |

## Estrutura do projeto

Projeto único Next.js, sem monorepo — ver `PLANO_TECNICO.md` seção 18 para
o racional.

```text
src/
  app/              # rotas (App Router): (public) = login/convite/recuperação,
                     # (app) = área autenticada, api/ = route handlers
  components/       # ui/ (design system), layout/, feedback/ (loading, erro, acesso negado)
  modules/          # regras de negócio por domínio (auth, profile, ...)
  services/         # regras de negócio puras e testáveis (ainda vazio na Fase 1)
  authorization/     # camada de políticas tipada (RBAC) + resolução de sessão
  jobs/              # abstração AsyncTaskQueue + adapter sobre a tabela `jobs`
  integrations/      # supabase/ (clients), titan/, youtube/ (Fases futuras)
  lib/               # utilidades (env, fonts, cn, labels)
supabase/
  migrations/        # todo o schema, versionado — nunca editar via Dashboard
  seed.sql           # dados fictícios de desenvolvimento
netlify/functions/    # Scheduled/Background Functions (Fases futuras)
tests/
  unit/               # Vitest — não dependem de banco
  integration/        # exigem Supabase local (Docker)
docs/
  design-system.md    # tokens extraídos da identidade Makários
```

## Segurança — pontos que todo mundo que mexer no código precisa saber

- **Nunca** importe `@/integrations/supabase/admin` em um Client
  Component. O ESLint bloqueia isso fora de uma lista de exceções
  revisadas (`eslint.config.mjs`), e o pacote `server-only` faz o build
  falhar como segunda camada de proteção.
- Toda regra de autorização vive em `src/authorization` — nunca decida
  permissão dentro de um componente React ou usando Zod.
- Toda alteração de schema é uma migration em `supabase/migrations/`,
  nunca uma mudança feita só pelo Dashboard do Supabase.
- RLS é obrigatória em toda tabela nova exposta em `public`. Tabelas
  internas (`jobs`, `audit_logs`) vivem no schema `private`, nunca exposto
  pela API automática.
