# Relatório da Fase 1 — Fundação

**Status:** entregue, aguardando validação. **Nenhuma Fase 2 foi iniciada.**

---

## 1. Resumo do que foi implementado

- Projeto Next.js único (App Router, TypeScript, sem monorepo), hospedagem
  alvo Netlify.
- Integração com Supabase: clients separados para browser, server (SSR,
  respeita RLS) e administrativo (secret key, exclusivamente server-side).
- 13 migrations SQL cobrindo: extensões/schema privado, `roles`,
  `permissions`/`role_permissions`, `profiles`, `user_roles` (sempre
  global), `invitations`, funções auxiliares de auth + gatilho
  `handle_new_user`, RLS de `profiles`/`roles`/`permissions`/
  `role_permissions`/`user_roles`/`invitations`, auditoria via trigger
  (`private.audit_logs`), e a fila `private.jobs` com captura transacional
  (`FOR UPDATE SKIP LOCKED`).
- Autenticação completa via Supabase Auth: convite, primeiro acesso, login,
  recuperação de senha, encerramento de sessão.
- Múltiplos perfis por conta, com seleção e troca de perfil ativo via
  cookie httpOnly, sempre revalidado contra os perfis reais do usuário.
- Camada de políticas tipada (`src/authorization`), sem Zod na decisão de
  autorização.
- Abstração `AsyncTaskQueue` com um adapter inicial sobre a tabela `jobs`
  — apenas estrutura e contratos, nenhum processador de tarefa ainda.
- Design system inicial com tokens extraídos da identidade Makários
  (`docs/design-system.md`), componentes de UI base e estados de
  carregamento/erro/acesso negado/conta suspensa.
- 22 testes unitários (autorização + adapter da fila), todos passando, sem
  dependência de banco. Testes de integração de RLS escritos, mas **não
  executados** (ver pendências).
- `lint`, `typecheck`, `test` e `build` rodando limpos.

## 2. Como os 10 cuidados técnicos pedidos foram endereçados

1. **Fila de tarefas** — tabela `private.jobs` criada com exatamente os
   campos pedidos (`id, type, payload, status, attempts, max_attempts,
   available_at, locked_at, locked_by, started_at, completed_at, failed_at,
   last_error, idempotency_key, created_at, updated_at`). Captura via
   `public.claim_job()`, que usa `FOR UPDATE SKIP LOCKED` dentro de uma
   transação (`supabase/migrations/00000000000013_jobs.sql`). Nenhum
   processador de tarefa foi implementado — só a estrutura e os contratos
   (`src/jobs/asyncTaskQueue.ts`, `src/jobs/adapters/supabaseJobsQueue.ts`).
2. **Distribuição das tarefas** — documentado em `PLANO_TECNICO.md` (seção
   5/6): Supabase Cron/funções Postgres para o que é próximo ao banco
   (encerramento de avaliação, liberação de gabarito), Netlify Background
   Functions para o que precisa de runtime Node ou é demorado (PDF,
   importação, lote de e-mail), Netlify Scheduled Function só localizando/
   disparando trabalho, nunca processando tarefa pesada. Nenhum desses
   workers foi implementado nesta fase (fora do escopo).
3. **Tabelas internas não expostas** — `jobs` e `audit_logs` vivem no
   schema `private` (nunca roteado pelo PostgREST, que só expõe `public`).
   As funções de manejo da fila (`enqueue_job`, `claim_job`, `complete_job`,
   `fail_job`) precisam ficar em `public` para serem chamáveis via
   `supabase.rpc(...)`, mas têm `EXECUTE` revogado de `anon`/`authenticated`
   e concedido só a `service_role` — ver fim de
   `00000000000013_jobs.sql`. RLS habilitada (sem policies = deny-all) em
   ambas as tabelas como defesa adicional.
4. **Clients Supabase separados** — `src/integrations/supabase/{client,
   server,admin}.ts`. O client administrativo importa `server-only`
   (quebra o build se for puxado por um Client Component) e está listado
   em `no-restricted-imports` no `eslint.config.mjs`, com uma lista
   explícita de exceções revisadas (`src/jobs/index.ts`,
   `src/modules/**/actions/**`) — qualquer outro import dele falha o lint
   antes mesmo de chegar ao build.
5. **Avaliações (preservado no modelo, não implementado)** — nenhuma
   tabela de avaliação foi criada nesta fase (fora do escopo). As
   invariantes pedidas (resposta correta nunca vai para o aluno, snapshot
   imutável, frontend recebe só o necessário, dados de correção
   exclusivos do servidor até liberação do gabarito) já estão registradas
   como decisão de arquitetura em `PLANO_TECNICO.md` (seções 6, 8 e 13 —
   `assessment_attempt_questions` como snapshot imutável,
   `assessment_eligible_students` como conjunto fixo) para serem
   implementadas exatamente assim na Fase 5.
6. **Escopo da Fase 1** — ver lista de arquivos abaixo; nenhum item da
   lista de exclusões (conteúdo acadêmico, vídeos, exercícios, avaliações,
   recuperação, frequência, reposições, certificados, importação de
   planilhas, comunicados institucionais completos, dashboards acadêmicos
   reais) foi implementado.
7. **Identidade visual** — `makarios-docs/brand/*` foi lido integralmente
   antes de qualquer código de UI; cor extraída por amostragem de pixel
   (não "adivinhada"), tipografia da marca identificada (Heuvel Grotesk) e
   substituída temporariamente por Poppins (com a pendência registrada),
   nenhuma fonte de terceiros redistribuída no repositório. Detalhes e o
   que foi assumido vs. extraído: `docs/design-system.md`.
8. **Migrations** — todo o schema está em `supabase/migrations/`,
   numerado e versionado; nada foi (ou deveria ser) feito só pelo
   Dashboard. Seed fictício em `supabase/seed.sql`. Instruções de reset/
   aplicação/geração de tipos em `supabase/README.md`.
9. **Testes obrigatórios** — ver seção 4 abaixo (o que passou de fato vs.
   o que está escrito mas não pôde ser executado nesta sessão).
10. **Entrega** — lint/typecheck/test/build executados e limpos (seção 5);
    este relatório, o README e a lista de arquivos/migrations abaixo.

## 3. Arquivos criados (por área)

**Configuração do projeto**: `package.json`, `tsconfig.json`,
`next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
`vitest.config.ts`, `vitest.integration.config.ts`, `middleware.ts`,
`.env.example`, `.gitignore`.

**Supabase / integrações** (`src/integrations/supabase/`): `client.ts`,
`server.ts`, `admin.ts`, `middleware.ts`, `types.ts` (placeholder — ver
pendências).

**Autorização** (`src/authorization/`): `types.ts`, `policies.ts`,
`session.ts`, `index.ts`.

**Fila de tarefas** (`src/jobs/`): `asyncTaskQueue.ts`,
`adapters/supabaseJobsQueue.ts`, `index.ts`.

**Autenticação** (`src/modules/auth/`): `schemas.ts`,
`actions/{signIn,signOut,requestPasswordReset,updatePassword,
createInvitation}.ts`,
`components/{LoginForm,RequestPasswordResetForm,SetPasswordForm,
CreateInvitationForm}.tsx`.

**Perfil / seleção de perfil** (`src/modules/profile/`):
`actions/setActiveRole.ts`, `components/SelectRoleForm.tsx`.

**Design system / UI** (`src/components/ui/`): `Button.tsx`, `Input.tsx`,
`PasswordInput.tsx`, `Label.tsx`, `FormError.tsx`, `Card.tsx`, `Alert.tsx`,
`Spinner.tsx`. **Layout** (`src/components/layout/`): `AuthShell.tsx`,
`AppShell.tsx`. **Estados** (`src/components/feedback/`):
`LoadingState.tsx`, `ErrorState.tsx`, `AccessDenied.tsx`,
`SuspendedAccount.tsx`.

**Rotas** (`src/app/`): `layout.tsx`, `loading.tsx`, `error.tsx`,
`not-found.tsx`, `page.tsx`, `globals.css`,
`(public)/{layout,login/page,primeiro-acesso/page,recuperar-senha/page,
redefinir-senha/page,selecionar-perfil/page}.tsx`,
`(app)/{layout,dashboard/page,acesso-negado/page,professor/page,
administracao/page,coordenacao/page,conteudo/page}.tsx`,
`api/auth/callback/route.ts`.

**lib**: `src/lib/{env,fonts,cn,roleLabels}.ts`.

**Documentação**: `README.md`, `PLANO_TECNICO.md` (já existente,
atualizado nas rodadas anteriores), `docs/design-system.md`,
`supabase/README.md`, este arquivo.

**Testes**: `tests/setup/vitest.setup.ts`, `tests/mocks/server-only.ts`,
`tests/unit/authorization.test.ts`, `tests/unit/jobs.test.ts`,
`tests/integration/rls.integration.test.ts`.

**Scripts**: `scripts/check-no-secret-in-bundle.mjs`.

## 4. Migrations criadas

Todas em `supabase/migrations/`, aplicadas nesta ordem:

1. `00000000000001_extensions_and_schemas.sql` — `pgcrypto`, schema `private`.
2. `00000000000002_roles.sql` — enum `role_slug`, tabela `roles`, seed dos 5 perfis.
3. `00000000000003_permissions.sql` — `permissions`, `role_permissions`, matriz mínima da Fase 1.
4. `00000000000004_profiles.sql` — tabela `profiles` + trigger `updated_at`.
5. `00000000000005_user_roles.sql` — tabela `user_roles` (sempre global).
6. `00000000000006_invitations.sql` — tabela `invitations`.
7. `00000000000007_auth_functions_and_triggers.sql` — `has_role`, `is_admin`, `current_profile_is_active`, `set_audit_justification`, `handle_new_user` (+ trigger em `auth.users`).
8. `00000000000008_rls_profiles.sql`
9. `00000000000009_rls_roles_and_permissions.sql`
10. `00000000000010_rls_user_roles.sql`
11. `00000000000011_rls_invitations.sql`
12. `00000000000012_audit_log.sql` — `private.audit_logs` + `private.log_audit_event()` + triggers em `profiles`/`user_roles`/`invitations`.
13. `00000000000013_jobs.sql` — `private.jobs` + `claim_job`/`complete_job`/`fail_job`/`enqueue_job` (em `public`, `EXECUTE` restrito a `service_role`).

Mais `supabase/seed.sql` (dados fictícios) e `supabase/README.md`
(instruções operacionais).

## 5. Resultado dos comandos de entrega

Executados nesta sessão, nesta ordem, todos limpos:

```text
npm run lint        → sem erros, sem warnings
npm run typecheck    → sem erros
npm test              → 2 arquivos, 22 testes, todos passando
npm run build          → build de produção concluído; todas as 14 rotas
                          corretamente marcadas como dinâmicas (ƒ)
npm run check:no-secret-in-bundle → OK, 0 ocorrências em 24 arquivos client-side
```

## 6. Testes obrigatórios — o que foi provado de fato vs. o que ainda depende de ambiente

**Executados nesta sessão (Vitest, sem dependência de banco/Docker)**:

- ✅ aluno não acessa área de professor
- ✅ professor não acessa administração
- ✅ editor de conteúdo não acessa gestão de matrículas
- ✅ coordenação gerencia matrículas/convites, mas não perfis/permissões/auditoria
- ✅ administrador herda o que a coordenação pode, mais exclusividades próprias
- ✅ usuário só lê/atualiza o próprio perfil
- ✅ com múltiplos perfis e nenhum perfil ativo resolvido, nenhuma área é liberada
- ✅ trocar o perfil ativo muda as permissões concedidas (mesma conta, dois contextos)
- ✅ um perfil ativo que a conta não possui de fato é sempre negado (defesa contra cookie adulterado)
- ✅ usuário suspenso perde o acesso a tudo, mesmo com o perfil certo
- ✅ resolução de perfil ativo (cookie válido, cookie inválido, perfil único, múltiplos perfis, zero perfis)
- ✅ adapter da fila de tarefas chama as funções RPC certas com os parâmetros certos (`enqueue_job`, `claim_job`, `complete_job`, `fail_job`)
- ✅ **chave administrativa não é enviada ao bundle do navegador** — verificado empiricamente após `npm run build` com `scripts/check-no-secret-in-bundle.mjs` (não é uma alegação documentada, foi executado e o resultado está na seção 5)

**Escritos, mas NÃO executados nesta sessão** (`tests/integration/
rls.integration.test.ts`) — **pendência declarada**, não uma alegação de
sucesso:

- acesso direto à API do Supabase também é bloqueado (aluno não lê profile
  de outro usuário / não se autoatribui perfil admin)
- RLS bloqueia leitura e escrita não autorizadas (professor não lê
  convites; coordenação cria convite mas professor não; usuário suspenso
  não consegue atualizar o próprio perfil)
- a tabela interna `jobs` não é alcançável via API mesmo autenticado como admin

**Motivo**: este ambiente de execução não tinha Docker nem Supabase CLI
disponíveis (verificado no início da Fase 1 — `docker --version` e
`supabase --version` falharam). Não é possível rodar `supabase start` nem
`supabase db reset` aqui, logo não há banco Postgres real contra o qual
rodar as policies de RLS. O arquivo de teste foi escrito para ser
executado assim que o ambiente local existir:

```bash
supabase start
supabase db reset
npm run test:integration
```

## 7. Pendências desta entrega (honestas, não escondidas)

1. **Testes de integração de RLS não executados** — ver seção 6.
   Primeira coisa a rodar ao configurar Docker/Supabase CLI localmente.
2. **`supabase/seed.sql` não validado** — escrito seguindo o padrão
   documentado pela comunidade Supabase para inserir usuários de teste
   diretamente em `auth.users`/`auth.identities`, mas nunca executado
   contra uma instância real nesta sessão. Pode precisar de ajuste fino
   dependendo da versão exata do GoTrue que `supabase start` baixar.
3. **`src/integrations/supabase/types.ts` é um placeholder escrito à mão**
   — cobre só as tabelas da Fase 1, sem os metadados completos que
   `supabase gen types typescript` geraria. Precisa ser regenerado como
   primeiro passo assim que houver um projeto Supabase acessível (local
   ou remoto) — comando documentado em `supabase/README.md`.
4. **Nenhum teste end-to-end contra um projeto Supabase real** (login de
   verdade, convite de verdade recebido por e-mail, etc.) — não existe
   projeto Supabase provisionado nesta sessão; só foi possível validar
   build, tipos e lógica pura.
5. **Fonte da marca (Heuvel Grotesk)** — substituída por Poppins até
   confirmação de licença de uso web (ver `docs/design-system.md`).
6. **Cor de fundo do deck de identidade (`#1482BF`) diverge levemente do
   azul do arquivo "oficial" (`#2E7FBF`)** — usado o valor do arquivo
   oficial; divergência registrada para confirmação com quem aprovou a
   marca.
7. **`supabase/config.toml` não existe neste commit** — é gerado por
   `supabase init` localmente; não foi fabricado à mão para não arriscar
   um formato desatualizado/incompatível com a versão da CLI que for
   instalada.
8. **Git**: repositório local inicializado e primeiro commit criado
   nesta entrega (ver mensagem de commit), mas **nenhum remoto do GitHub
   foi configurado nem houve push** — a integração com GitHub/Netlify
   propriamente dita (branch protegida, Actions, conexão do Netlify ao
   repositório) é a próxima etapa operacional, fora do que pode ser feito
   sem as credenciais/decisões do usuário.

## 8. Rodando localmente (resumo — detalhes no README/supabase/README.md)

```bash
npm install
supabase init && supabase start && supabase db reset
cp .env.example .env.local   # preencha com os valores impressos pelo supabase start
npm run dev
```

---

Aguardando validação do usuário antes de iniciar a Fase 2
(Administração acadêmica).
