# Plano Técnico — Plataforma Makários

**Instituição:** Igreja Emaús · **Escola:** Escola Makários · **Temporada inicial:** 2026.2
**Status:** Fase 0 — Planejamento técnico, revisado após validação do usuário (nenhum código de
produção foi criado ainda)

Fontes lidas integralmente, na ordem indicada por `makarios-docs/docs/00-README.md`:
`01-visao-produto-e-escopo.md`, `02-regras-finais-de-negocio.md`, `03-perfis-e-permissoes.md`,
`04-mapa-de-telas-e-jornadas.md`, `05-modelo-de-dados-conceitual.md`,
`06-integracoes-e-requisitos-tecnicos.md`, `07-mvp-roadmap-e-criterios-de-aceitacao.md`,
`08-dados-iniciais-temporada-2026-2.md`, além de `makarios-docs/brand/*` e
`makarios-docs/certificate/*`.

Prioridade seguida em caso de conflito: **02 > 08 > demais docs > identidade visual > outras referências.**

Nota sobre o arquivo `certificate/MAKARIOS CERTIFICADO SEM NOME.pdf.pdf`: ele contém, no arquivo
fornecido, exemplos com nomes de pessoas reais. Ele foi usado **apenas como referência de layout
visual** (moldura azul, logo, fita com folha, logo EMAÚS, posição de assinaturas). Nenhum nome real
foi copiado para este documento ou será usado como dado de exemplo no sistema.

**Infraestrutura aprovada** (decisão do usuário, vinculante para todo o restante do plano):
**GitHub** (repositório, versionamento, CI), **Netlify** (hospedagem e deploy do Next.js),
**Supabase** (banco Postgres, autenticação, storage, RLS, cron e funções de banco) e **Titan**
como SMTP institucional (`makarios@igrejaemaus.com.br`). A arquitetura prioriza esses serviços
sempre que forem tecnicamente adequados, evitando peças de infraestrutura adicionais
(ex.: ORM externo, fila dedicada, object storage externo) quando o próprio Supabase/Netlify já
resolve a necessidade.

---

## 1. Resumo da compreensão do produto

A Plataforma Makários é o ambiente digital de **apoio** ao ensino presencial da Escola Makários
(braço formativo da Igreja Emaús). Ela não substitui as aulas presenciais — libera os encontros
para aplicação, discussão e ministração ao mover o conteúdo denso (vídeos, leitura, exercícios)
para o ambiente online.

A escola tem três volumes sequenciais — **Essência → Caminho → Voz** — cada um com 16h
presenciais, avaliação final própria, recuperação, frequência mínima de 75% e certificado próprio.
Concluir os três volumes com validação acadêmica gera a **formação completa**, cujo certificado
não depende de presença em formatura.

O sistema abrange: matrícula (manual/importada, nunca pública), liberação gradual de conteúdo,
vídeos do YouTube não listados com registro de progresso, exercícios formativos sem nota,
avaliação final com cronômetro server-side, prova com **snapshot imutável** por tentativa e
correção automática, recuperação com trilha de revisão obrigatória, frequência por minutos
acadêmicos (não por contagem de encontros) com **reposição registrada como crédito separado** (a
falta original nunca é reescrita como presença), aprovação validada manualmente pela coordenação,
certificados em PDF com QR/validação pública e **signatários configuráveis** (não fixos no
código), e comunicação institucional via e-mail Titan (`makarios@igrejaemaus.com.br`).

Cinco perfis (aluno, professor, coordenação, administrador, editor de conteúdo) podem coexistir na
mesma conta, com trocas de perfil sem duplicar cadastro. Autorização deve ser aplicada no backend
**e** reforçada por Row Level Security no banco — nunca apenas ocultando UI.

O MVP atende exclusivamente à Igreja Emaús (estrutura para múltiplas instituições pode existir no
modelo de dados, mas não na interface).

---

## 2. Lista consolidada de funcionalidades do MVP

**Fundação**
- Autenticação por convite (Supabase Auth), criação de senha, recuperação de senha, expiração de
  token, encerramento de sessão, suspensão de acesso.
- Múltiplos perfis por conta com seleção/troca de perfil (perfis sempre globais; escopo de
  professor vem exclusivamente de `teacher_assignments`).
- Autorização em três camadas: Row Level Security (Postgres), camada de políticas tipada em
  código (Server Actions/Route Handlers) e ocultação de UI apenas como conveniência de UX.
- Auditoria básica de ações sensíveis, com registro garantido por triggers de banco.
- Design system responsivo (mobile-first para aluno/professor, desktop-first para
  coordenação/administração).

**Administração acadêmica**
- Volumes (Essência, Caminho, Voz) com pré-requisitos e exceções auditadas.
- Temporadas → **ofertas de volume por temporada** (`season_volume_offerings`) → turmas → modelos
  de horário (terça/quinta, sábado, personalizado) → encontros.
- Cadastro/atribuição de professores; cadastro/importação de alunos (XLSX/CSV); matrícula manual.
- Matrícula simultânea em mais de um volume, com progresso/frequência/nota independentes.

**Conteúdo e área do aluno**
- Estrutura volume → módulo → aula → conteúdo, com liberação condicional (data, conclusão de
  conteúdo/exercício, encontro presencial, manual, por turma/aluno).
- Player de vídeo do YouTube não listado com tracking de progresso (posição, %, conclusão em 80%
  configurável).
- Materiais (PDF/apresentação) com controle de download.
- Dashboard, "meus volumes", página de aula, agenda, "minha situação" (checklist de conclusão).

**Área do professor**
- Dashboard, agenda, minhas turmas, preparação de aula, biblioteca de materiais oficiais
  (somente leitura).
- Registro de frequência (presente/ausente/atrasado/parcial/justificada/reposição/pendente).
- Relatório pós-aula.
- Sem acesso a dados financeiros/administrativos e sem edição de conteúdo oficial.

**Exercícios e avaliações**
- Banco de questões (múltipla escolha, V/F, associação, ordenação, preenchimento com opções —
  nunca discursiva).
- Exercícios formativos (não valem nota, podem bloquear avanço, tentativas ilimitadas opcionais).
- Avaliação final por volume (20 questões, 60 min, janela de 14 dias, correção automática, nota
  mínima 6, cronômetro server-side, autosave). Ao iniciar, o sistema grava um **snapshot
  imutável** da prova daquele aluno (questões, ordem, ordem das alternativas, valor por questão,
  resposta correta vigente no momento do início).
- **Conjunto fixo de alunos elegíveis** registrado no momento da publicação/liberação da
  avaliação — matrículas criadas depois não entram nesse conjunto e não bloqueiam o gabarito.
- Gabarito liberado conforme a primeira condição satisfeita (todos os elegíveis enviaram / prazo
  encerrado / liberação manual).
- Recuperação (20 questões distintas, trilha de revisão obrigatória, uma tentativa + exceção
  manual, nota final = maior entre regular e recuperação).

**Frequência e reposição**
- Cálculo por minutos acadêmicos (intervalos excluídos).
- **Reposição como crédito separado**: a falta original permanece registrada como falta; a
  presença na reposição gera um crédito de minutos vinculado à falta de origem, limitado à carga
  perdida, só contabilizado após validação da coordenação.
- Fluxo de solicitação → análise → aprovação/recusa → realização → validação → crédito aplicado
  ao cálculo de frequência (nunca reescreve o registro original).

**Certificados e comunicação**
- Envio de e-mail via SMTP Titan — parte pelo próprio Supabase Auth (convite, primeiro acesso,
  recuperação de senha, mensagens de segurança) e parte por uma camada própria server-side
  (comunicados, avaliação, reposição, certificado, notificações), com função de teste no painel
  admin.
- Geração de PDF de certificado por volume (após validação de aprovação) e de formação completa
  (após conclusão dos 3 volumes + validação final, independente de formatura), com
  **signatários configuráveis** (nome, cargo, imagem de assinatura, ordem, período de validade).
- Código de validação único + QR Code + página pública de validação, sem expor o bucket privado
  de certificados.

**Dashboards, relatórios e estabilização**
- Indicadores (matrículas, frequência média, alunos em risco, pendências).
- Relatórios filtráveis (PDF/planilha).
- Auditoria completa (admin) e parcial (coordenação).
- Testes automatizados dos cálculos acadêmicos (nota, frequência, prazos, equivalências) e das
  políticas de RLS críticas.

Fora do MVP (explícito nos docs e nas restrições do usuário): pagamento, matrícula pública,
questões discursivas, correção manual de avaliação, obrigatoriedade de formatura para certificado,
edição de conteúdo por professor, app nativo, offline, WhatsApp, QR Code de presença, múltiplas
igrejas na UI, fórum/rede social.

---

## 3. Perfis de usuário e permissões

| Perfil | Escopo típico | Pode | Não pode |
|---|---|---|---|
| **Aluno** | Próprias matrículas | Ver conteúdo liberado, assistir vídeo, baixar material permitido, fazer exercício/avaliação/recuperação, acompanhar nota/frequência, solicitar reposição, emitir certificado liberado | Alterar nota/frequência, autoconfirmar reposição, acessar volume não matriculado, editar conteúdo, validar aprovação |
| **Professor** | Turmas/encontros atribuídos, **exclusivamente via `teacher_assignments`** (perfil em `user_roles` é sempre global — nunca carrega turma/volume) | Ver turmas/alunos atribuídos, registrar frequência (inclui parcial/atraso), relatório pós-aula, baixar materiais oficiais | Editar conteúdo oficial, criar/corrigir avaliação, gerenciar matrícula, validar aprovação, emitir certificado, ver dados financeiros, ver outras turmas |
| **Coordenação** | Instituição (Igreja Emaús) | Tudo do fluxo acadêmico: temporadas, ofertas de volume, turmas, matrícula, exceções, conteúdo, exercícios, avaliações, frequência (registrar e corrigir), reposição, recuperação, validação de aprovação, certificado de volume, relatórios, comunicados | Gerenciar perfis/permissões, configurações institucionais, invalidar certificado, liberar certificado de formação completa |
| **Administrador** | Global | Tudo da coordenação + perfis/permissões, suspensão/reativação, sessões, configuração institucional/e-mail/certificado/regras acadêmicas, signatários de certificado, import/export, auditoria completa, invalidação de certificado, certificado de formação completa | — |
| **Editor de conteúdo** | Global (sobre conteúdo) | Criar/editar módulos, aulas, vídeos, materiais, exercícios, avaliações, banco de questões, regras de liberação, pré-visualizar como aluno | Matrícula, frequência, notas, validação, certificados, gestão de usuários |

Regras estruturais:
- Uma conta pode ter **N perfis simultâneos** em `user_roles` — **sempre globais** (`user_id` +
  `role_id`, sem `class_id`/`volume_id`). A UI expõe seletor de perfil ativo (`AUT-04`).
- O vínculo do professor com turmas/encontros específicos vive **exclusivamente** em
  `teacher_assignments` — nunca há uma segunda fonte de verdade sobre o escopo do professor.
- Controle de acesso considera simultaneamente: perfil ativo, instituição, matrícula, temporada,
  oferta de volume, turma, vínculo do professor (`teacher_assignments`), regra de liberação,
  status do usuário, status da matrícula.
- A autorização é validada em **três camadas independentes**: (1) Row Level Security no Postgres
  — funciona mesmo em acesso direto à API do Supabase; (2) camada de políticas tipada em código,
  avaliada em toda Server Action/Route Handler/função RPC crítica; (3) ocultação de UI, apenas
  como conveniência de experiência, nunca como mecanismo de segurança.

---

## 4. Principais regras de negócio (síntese operacional)

1. **Matrícula**: 1 usuário → N matrículas; cada matrícula = 1 volume + 1 temporada (via
   `season_volume_offering`) + 1 turma principal, com frequência/progresso/avaliação/certificado/
   status independentes. Sempre manual ou por importação (nunca pública/self-service).
2. **Pré-requisito**: Essência → Caminho → Voz. Exceção só por autorização registrada e auditada
   (aluno, volume, requisito pendente, justificativa, responsável, data/hora).
3. **Conteúdo**: liberação condicional configurável (data, pós-encontro, pós-conclusão, pós-envio
   de exercício, manual, por turma/aluno); volume concluído continua acessível enquanto a conta
   estiver ativa.
4. **Vídeo**: YouTube não listado, embutido, sem link em destaque; 80% padrão para conclusão
   (configurável por conteúdo); sem proteção absoluta contra manipulação — limitação aceita.
5. **Exercício**: nunca vale nota, nunca é discursivo; pode bloquear avanço; pode ter tentativas
   ilimitadas; feedback pode ser mostrado após envio.
6. **Avaliação final**: 1 por volume/oferta, 20 questões, 60 min, janela de 14 dias (com abertura/
   fechamento padrão herdados de `season_volume_offering.assessment_open_at`/`close_at`, podendo
   a avaliação ter datas próprias dentro dessa janela), nota total 10, média mínima 6, 1 tentativa
   regular, correção automática, sem discursiva, embaralhamento configurável. Frequência
   insuficiente **não** bloqueia a tentativa. Ao iniciar, gera-se um **snapshot imutável** da
   prova daquele aluno.
7. **Gabarito**: liberado no primeiro evento entre — todos os alunos do **conjunto fixo de
   elegíveis** (definido no momento da publicação/liberação, nunca recalculado depois) enviaram /
   prazo encerrado / liberação manual da coordenação. Uma matrícula criada após esse momento não
   integra o conjunto e não atrasa a liberação.
8. **Recuperação**: 20 questões diferentes, mesmos objetivos, 60 min, janela herdada de
   `season_volume_offering.recovery_open_at`/`close_at`, 1 tentativa + 1 excepcional manual;
   exige trilha de revisão concluída antes da tentativa; nota final = maior entre regular e
   recuperação; histórico completo preservado; também gera snapshot imutável por tentativa.
9. **Frequência**: por minutos acadêmicos (não por contagem de encontro); mínimo 75% de 16h
   (12h); intervalo não conta; estados do registro original: presente/ausente/atrasado/parcial/
   justificada/reposição/pendente; toda alteração registra valor anterior, novo, responsável,
   justificativa e data.
10. **Reposição**: a ausência original **nunca é convertida em presença**. A presença na
    reposição gera um **crédito separado** vinculado à falta de origem e ao encontro de destino,
    limitado aos minutos perdidos naquela falta, e só passa a contar na frequência reconhecida
    **após validação** da coordenação. A frequência final da matrícula é a soma dos minutos de
    presença direta com os créditos de reposição validados.
11. **Aprovação**: nunca automática — sistema marca "apta para aprovação"; coordenação valida
    nota ≥ 6, frequência ≥ 75% (já considerando créditos de reposição validados), exercícios/
    conteúdos obrigatórios concluídos, reposições regularizadas, recuperação concluída (se
    aplicável); só então libera o certificado do volume.
12. **Certificado**: por volume (após validação) e de formação completa (após os 3 volumes +
    validação final). Participação em formatura **nunca** bloqueia a emissão. Os dados de
    signatário (nome, cargo, imagem de assinatura) são resolvidos a partir de uma tabela de
    configuração e **gravados como snapshot no momento da emissão**, para que o certificado
    permaneça correto mesmo se o signatário mudar depois.
13. **Auditoria obrigatória (mínimo)**: alteração de frequência/nota, cancelamento de tentativa,
    liberação excepcional, exceção de pré-requisito, validação de aprovação, emissão/invalidação
    de certificado, alteração de permissão/matrícula, publicação/substituição de conteúdo oficial.
    Garantida por triggers de banco (ver seção 8), não apenas pela camada de aplicação.

---

## 5. Proposta de arquitetura técnica

**Padrão:** um único projeto Next.js (App Router, TypeScript), sem monorepo, hospedado no
Netlify, com **Supabase como plataforma de backend** (Postgres, Auth, Storage, RLS, Cron e
funções de banco). Nenhum servidor/processo persistente é necessário — toda a stack é serverless
por padrão, o que exige que qualquer trabalho assíncrono seja modelado sem depender de um worker
sempre ativo.

### Modelo de autorização em três camadas

```text
Requisição (browser ou chamada direta à API do Supabase)
        │
        ▼
1) Row Level Security (Postgres)         ← linha de defesa que funciona mesmo sem
   políticas por tabela, checando           passar pelo Next.js (proteção contra
   auth.uid() + vínculo (ex.: turma)         acesso direto à API REST do Supabase)
        │
        ▼
2) Camada de políticas tipada (TS)        ← chamada obrigatória em toda Server Action /
   + funções Postgres (RPC/SECURITY         Route Handler / RPC que executa uma regra
   DEFINER) para operações críticas          de negócio crítica (aprovação, certificado,
   multi-tabela                              reposição, permissões)
        │
        ▼
3) UI (mostra/esconde)                    ← apenas conveniência de experiência,
                                              nunca o único controle
```

RLS resolve "esta identidade pode tocar nesta linha?" — é a defesa mínima obrigatória em toda
tabela exposta pela API automática do Supabase. A camada de políticas tipada e as funções
Postgres resolvem regras de negócio que dependem de **estado de várias tabelas ao mesmo tempo**
(ex.: só aprovar quando nota ≥ 6 **e** frequência ≥ 75% **e** reposições regularizadas) — algo que
RLS sozinho não expressa bem. As duas camadas são complementares, não redundantes.

### Tarefas assíncronas: abstração própria, sem Redis/BullMQ obrigatório

```text
interface AsyncTaskQueue {
  enqueue(type: TaskType, payload: TaskPayload, options?: { runAfter?: Date }): Promise<TaskId>
  markRunning(taskId): Promise<void>
  markDone(taskId, result?): Promise<void>
  markFailed(taskId, error, { retry: boolean }): Promise<void>
}
```

Essa interface é o único ponto de contato do restante da aplicação com "processamento em
background" — nenhuma regra de negócio conhece o mecanismo de execução por trás dela. A
**implementação inicial** (`SupabaseTableTaskQueue`) usa uma tabela `jobs` no próprio Postgres do
Supabase (`id`, `type`, `payload jsonb`, `status`, `attempts`, `last_error`, `run_after`,
`locked_at`, `created_at`), processada por:

- **Supabase Cron (`pg_cron`) + função Postgres**, para verificações que vivem inteiramente no
  banco (ex.: marcar tentativas de avaliação vencidas como encerradas) — roda a cada 1 minuto sem
  precisar sair do Postgres.
- **Netlify Scheduled Function**, executada em intervalo curto (ex.: 1–5 min), que varre `jobs`
  pendentes de tipos que exigem runtime Node (envio de e-mail via SMTP, geração de PDF,
  processamento de planilha) e delega para uma **Netlify Background Function**.
- **Supabase Edge Function**, reservada para integrações futuras que se beneficiem de rodar perto
  do banco (ex.: reagir a um webhook do Supabase Auth) — não é essencial no MVP inicial.

Se o volume de tarefas crescer a ponto de justificar uma fila real (throughput alto, necessidade
de prioridade/atraso fino, back-pressure), basta trocar a implementação de `AsyncTaskQueue` por um
adapter baseado em **BullMQ + Redis** — nenhuma chamada de `enqueue(...)` no resto do código
precisa mudar. Redis/BullMQ permanecem como **evolução possível**, não como dependência inicial.

### Diagrama

```text
┌───────────────────────────────────────────────────────────────────┐
│              Next.js App (TypeScript) — hospedado no Netlify        │
│  ┌───────────────┐   ┌────────────────────┐   ┌─────────────────┐  │
│  │ UI (App Router)│   │ Server Actions /   │   │ Camada de        │  │
│  │ RSC + Client   │──▶│ Route Handlers      │──▶│ políticas        │  │
│  │ components     │   │ (mutações/consultas)│   │ (autorização TS) │  │
│  └───────────────┘   └────────────────────┘   └────────┬─────────┘  │
│                                                          ▼           │
│                                              ┌─────────────────────┐│
│                                              │ Camada de serviços   ││
│                                              │ (regras de negócio,  ││
│                                              │  Zod para validação  ││
│                                              │  de entrada)         ││
│                                              └──────────┬──────────┘│
│                                                          ▼           │
│                                              ┌─────────────────────┐│
│                                              │ supabase-js (client  ││
│                                              │ tipado) + chamadas   ││
│                                              │ RPC para funções     ││
│                                              │ Postgres críticas    ││
│                                              └──────────┬──────────┘│
└─────────────────────────────────────────────────────────┼──────────┘
                                                            ▼
                              ┌────────────────────────────────────────┐
                              │                 Supabase                 │
                              │ ┌──────────────┐ ┌──────┐ ┌────────────┐ │
                              │ │ Postgres      │ │ Auth │ │ Storage     │ │
                              │ │ + RLS         │ │      │ │ (buckets    │ │
                              │ │ + triggers    │ │      │ │  por nível  │ │
                              │ │ + funções RPC │ │      │ │  de acesso) │ │
                              │ │ + tabela jobs │ │      │ │            │ │
                              │ └──────────────┘ └──────┘ └────────────┘ │
                              │ Supabase Cron (pg_cron) · Edge Functions │
                              └────────────────────────┬─────────────────┘
                                                        ▼
                    ┌───────────────────────────────────────────────────┐
                    │ Netlify Scheduled Functions (varrer `jobs`)          │
                    │ Netlify Background Functions (e-mail, PDF, import)   │
                    └───────────────────────────┬───────────────────────┘
                                                  ▼
                                         ┌──────────────────┐
                                         │ SMTP Titan         │
                                         │ (Nodemailer)        │
                                         └──────────────────┘
```

Princípios:
- **Toda autorização é reavaliada no servidor** (RLS + camada de políticas), nunca confiando em
  estado do cliente — inclusive contra chamadas que tentem acessar a API do Supabase diretamente,
  sem passar pelo Next.js.
- **Camada de serviços** concentra regras de negócio puras e testáveis (cálculo de frequência,
  elegibilidade de avaliação, crédito de reposição, elegibilidade de certificado) — Zod é usado
  apenas para validar o **formato** dos dados de entrada, nunca para decidir permissão.
- **Operações críticas multi-tabela** (aprovação, emissão/invalidação de certificado, validação
  de reposição, início de tentativa de avaliação com snapshot) são implementadas como **funções
  Postgres (RPC)**, chamadas via `supabase.rpc(...)` a partir da camada de serviço — garante
  atomicidade transacional mesmo se a chamada não vier do Next.js.
- **Projeto único, sem monorepo**: um único `package.json`, uma única árvore `src/`, sem
  `apps/`/`packages/` separados — reduz complexidade operacional enquanto o time for pequeno.
- **Ambientes progressivos, não três desde o início** (ver seção 20/23): Fase 1 exige apenas
  ambiente local de desenvolvimento; homologação é preparada antes do piloto; produção é
  preparada antes do uso com alunos reais.

---

## 6. Proposta de stack tecnológica

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript (frontend + backend) |
| Framework web | Next.js (App Router) |
| Estilo/design system | Tailwind CSS + shadcn/ui, tokens de marca Makários |
| Formulários/validação de dados | React Hook Form + Zod — **somente validação de formato/tipo, nunca decisão de autorização** |
| Autorização | Camada própria de políticas tipadas em TypeScript (padrão do MVP); CASL como alternativa **apenas se** a quantidade de combinações recurso×ação crescer a ponto de justificar um motor de regras — decisão a reavaliar, ver seção 23 |
| Repositório / CI | GitHub + GitHub Actions (lint, typecheck, test, build como check obrigatório antes do merge) |
| Hospedagem | Netlify (Next.js Runtime oficial, deploy automático a partir do GitHub, Deploy Previews por PR) |
| Banco de dados | Supabase Postgres — acesso via `supabase-js` (client oficial) + tipos TypeScript gerados do schema (`supabase gen types typescript`) |
| Migrations / schema | Supabase CLI (`supabase migration new/up`), SQL versionado no GitHub — nunca alteração manual via Dashboard sem migration correspondente |
| Operações transacionais complexas | Funções PostgreSQL (`plpgsql`) expostas via RPC, e triggers para auditoria e invariantes | 
| Autenticação | Supabase Auth (`auth.users`) + `@supabase/ssr` no Next.js; perfis acadêmicos em tabelas próprias (`profiles`, `user_roles`, `roles`) |
| Segurança de dados | Row Level Security ativa em toda tabela exposta, com políticas por perfil/vínculo |
| Armazenamento de arquivos | Supabase Storage (buckets segregados por nível de acesso, políticas de RLS de storage, URLs assinadas) |
| Tarefas assíncronas | Abstração própria `AsyncTaskQueue` (seção 5); implementação inicial via tabela `jobs` + Supabase Cron/Postgres functions + Netlify Scheduled/Background Functions — **sem Redis/BullMQ no MVP** |
| E-mail (autenticação) | SMTP customizado do Supabase Auth apontando para Titan (convite, primeiro acesso, recuperação, segurança) |
| E-mail (institucional) | Camada própria server-side com Nodemailer (SMTP Titan) + React Email, disparada por Background Function, com `email_logs` |
| Geração de PDF | `pdf-lib`, sobrepondo texto/QR em um template do certificado pré-exportado (PNG/PDF de alta resolução) — evita depender de Chromium headless em função serverless |
| QR Code | biblioteca `qrcode` |
| Import XLSX/CSV | `exceljs` (XLSX) + `papaparse` ou `csv-parse` (CSV), processado via Background Function, arquivos salvos no bucket `imports` do Supabase Storage |
| Testes unitários/integração | Vitest + Testing Library (lógica de serviço, pura, sem depender do Postgres) |
| Testes de políticas RLS | pgTAP **ou** testes de integração via `supabase-js` contra um projeto Supabase local — decisão a confirmar na Fase 1 (ver seção 23) |
| Testes E2E | Playwright, rodando contra um Deploy Preview do Netlify ou ambiente local |
| Ambiente local (dev) | Netlify Dev CLI + Supabase local (`supabase start`, via Docker) ou projeto Supabase de desenvolvimento na nuvem — decisão a confirmar na Fase 1 |

---

## 7. Justificativa das escolhas tecnológicas

- **Projeto único Next.js, sem monorepo**: para o porte atual (uma equipe pequena, um produto),
  `apps/`/`packages/` separados adicionam complexidade de build e navegação sem benefício real
  ainda; a divisão em `src/modules`, `src/services`, `src/authorization` já separa
  responsabilidades dentro de um único projeto, sem o custo de um monorepo.
- **GitHub + Netlify + Supabase + Titan**: infraestrutura já familiar ao usuário, com integração
  nativa entre as três (deploy automático do Netlify a partir do GitHub; Supabase acessível via
  client oficial e string de conexão padrão) e custo inicial baixo, adequado a uma única
  instituição.
- **`supabase-js` + tipos gerados em vez de Prisma**: Prisma exigiria uma camada de acesso a dados
  paralela à API que o próprio Supabase já expõe (REST/RPC via PostgREST) e complicaria o uso de
  RLS (o Postgres precisa identificar o usuário autenticado via JWT em cada consulta — o cliente
  oficial do Supabase já propaga isso nativamente; um ORM genérico exigiria replicar essa
  integração). Os tipos TypeScript gerados a partir do schema (`supabase gen types typescript`)
  entregam a mesma seguraça de tipagem ponta a ponta que se buscava com Prisma, sem essa fricção.
  Não há, neste momento, uma justificativa técnica indispensável para reintroduzir um ORM externo.
- **Migrations via Supabase CLI, SQL versionado no GitHub**: mantém o schema como código
  revisável em pull request, auditável e reproduzível em qualquer ambiente (local, homologação,
  produção) — e evita a categoria de erro "alguém alterou uma tabela direto no Dashboard e
  ninguém mais sabe".
- **Funções PostgreSQL/RPC para operações críticas multi-tabela**: operações como validar
  aprovação, emitir/invalidar certificado, iniciar uma tentativa de avaliação (com snapshot) ou
  validar um crédito de reposição envolvem múltiplas tabelas e precisam ser atômicas — uma função
  Postgres `SECURITY DEFINER`, chamada via RPC, garante que a transação inteira aconteça no banco,
  de forma consistente, e não fique espalhada em múltiplas idas e vindas do servidor de aplicação.
- **Row Level Security em toda tabela exposta**: o Supabase expõe automaticamente uma API REST
  sobre o Postgres; sem RLS, qualquer chamada direta a essa API com uma chave anônima/usuário
  autenticado poderia ler ou escrever dados fora do escopo do perfil. RLS é, portanto, a única
  forma de garantir que "a segurança funcione mesmo em acesso direto à API" — exigência explícita
  do usuário — e não apenas quando o tráfego passa pelo Next.js.
- **Supabase Auth em vez de um framework de autenticação genérico**: cobre nativamente convite por
  e-mail, criação de senha, recuperação de senha, expiração de token e gestão de sessão, com
  suporte a SMTP customizado (permitindo usar o Titan institucional nos e-mails de autenticação).
  A modelagem de **múltiplos perfis** (aluno + professor na mesma conta) continua sendo
  responsabilidade das tabelas `profiles`/`user_roles`/`roles`, separadas de `auth.users` —
  Supabase Auth resolve identidade, não RBAC acadêmico.
- **Supabase Storage com buckets segregados por nível de acesso**: atende "URL temporária ou
  autorizada quando necessário" com políticas de RLS de storage nativas, sem exigir configuração
  manual de um provedor de object storage separado.
- **Tabela `jobs` + Supabase Cron + Netlify Scheduled/Background Functions, atrás de uma interface
  própria (`AsyncTaskQueue`)**: nenhuma das plataformas escolhidas oferece um processo Node
  persistente — introduzir Redis/BullMQ agora adicionaria uma peça de infraestrutura extra sem
  necessidade real no volume esperado (uma única igreja). Abstrair o "enqueue" atrás de uma
  interface garante que trocar a implementação por BullMQ/Redis no futuro seja uma mudança
  localizada, não um redesenho.
- **`pdf-lib` em vez de Playwright/Puppeteer para o certificado**: funções serverless têm limites
  de tempo de execução e tamanho de pacote que tornam custoso embutir um Chromium headless.
  `pdf-lib` sobrepõe texto, código de validação e QR Code em um template do certificado exportado
  previamente em alta resolução — mais leve e mais previsível em ambiente serverless, ao custo de
  exigir mapeamento manual de coordenadas do template (ponto de atenção na seção 22).
- **Zod só para validação, autorização em camada própria**: manter essas responsabilidades
  separadas evita o anti-padrão de "esquema de validação também decide permissão", que mistura
  preocupações de formato de dado com preocupações de segurança e dificulta auditoria da lógica
  de autorização.
- **Vitest/Playwright/pgTAP**: cobre tanto lógica pura (frequência, nota, elegibilidade) quanto
  jornadas críticas ponta a ponta (avaliação com cronômetro, aprovação, certificado) e as
  políticas de RLS em si — que passam a ser parte central da segurança do sistema e por isso
  precisam de teste dedicado.

---

## 8. Modelo inicial do banco de dados

Baseado em `05-modelo-de-dados-conceitual.md`, ajustado pelas decisões desta revisão. Nomes de
tabela em `snake_case`, alinhados à convenção do Supabase/Postgres. Este é o modelo
**conceitual**; as migrations SQL detalhadas (tipos exatos, enums, índices, políticas de RLS)
serão produzidas na Fase 1.

**Identidade e acesso**
- `auth.users` — gerenciada pelo Supabase Auth (fora do controle direto da aplicação).
- `profiles` — 1:1 com `auth.users` (mesma PK), dados acadêmicos do usuário (nome, telefone,
  data de nascimento, foto, `status` — ativo/suspenso —, `ultimo_acesso`).
- `roles` — catálogo de perfis: `student`, `teacher`, `coordinator`, `admin`, `content_editor`.
- `user_roles` — **somente** `user_id` + `role_id` (relação global, sem escopo). Uma linha por
  perfil que o usuário possui; múltiplas linhas = múltiplos perfis na mesma conta.
- `permissions`, `role_permissions` — catálogo de (recurso, ação) por perfil, usado pela camada
  de políticas tipada como referência (a decisão final de autorização ainda cruza vínculos como
  `teacher_assignments`, não é só um lookup de tabela).
- `invitations` — trilha própria da aplicação sobre convites disparados (complementa o convite
  nativo do Supabase Auth com contexto acadêmico: qual perfil/matrícula o convite pretende criar).
- `audit_logs` — ver seção "Auditoria" abaixo.

**Instituição e estrutura acadêmica**
- `institutions`, `schools`, `volumes`, `volume_prerequisites`, `prerequisite_exceptions`,
  `modules`, `lessons`, `academic_units`, `seasons`, `class_templates`.
- **`season_volume_offerings`** *(nova entidade formal)* — representa a oferta de um volume
  dentro de uma temporada. Campos mínimos: `id`, `season_id`, `volume_id`, `status`,
  `assessment_open_at`, `assessment_close_at`, `recovery_open_at`, `recovery_close_at`,
  `academic_settings jsonb` (overrides pontuais de configuração acadêmica quando necessário,
  ex.: nota mínima diferente do padrão institucional para um caso excepcional autorizado).
- `classes` — agora **pertence a uma `season_volume_offering`** (`season_volume_offering_id`),
  em vez de referenciar `season`/`volume` diretamente; herda a temporada e o volume por
  transitividade.
- `class_meetings`, `teacher_assignments` (`teacher_id`, `class_id`, `meeting_id` opcional,
  `funcao`) — **única fonte de verdade** sobre o vínculo/escopo do professor.

**Alunos e matrículas**
- `enrollments` — `season_volume_offering_id`, `class_id` (turma principal, deve pertencer à
  mesma oferta), `student_id`, `status`, datas, nota final, frequência final.
- `enrollment_status_history`, `enrollment_progress`, `student_notes` (com nível de visibilidade:
  admin/coordenação/professor/aluno).

**Conteúdo**
`contents`, `content_files`, `video_contents`, `release_rules`, `content_progress`.

**Exercícios e avaliações**
- `question_bank`, `question_options`, `activities`, `activity_questions`, `activity_attempts`,
  `activity_answers`.
- `assessments` (agora referencia `season_volume_offering_id`), `assessment_questions`.
- **`assessment_attempt_questions`** *(nova entidade — snapshot imutável)*: uma linha por questão
  apresentada em uma tentativa (`attempt_id`, `question_id`, `position`, `options_order jsonb`,
  `points`, `correct_answer_snapshot jsonb`). Criada de uma vez, dentro de uma função Postgres
  (`fn_start_assessment_attempt`), no momento em que a tentativa começa; **nunca sofre `UPDATE`**
  depois de criada (imposto por trigger/política de RLS que bloqueia alteração após
  `attempt.started_at`).
- `assessment_attempts`, `assessment_answers`.
- **`assessment_eligible_students`** *(nova entidade — conjunto fixo)*: `assessment_id`,
  `enrollment_id`, `computed_at`, registrada no momento em que a avaliação é publicada/liberada.
  O cálculo de "todos os elegíveis enviaram" consulta **esta tabela**, não uma query dinâmica de
  matrículas ativas — matrícula criada depois não entra no conjunto.
- `recovery_paths`, `recovery_path_items`.

**Frequência e reposição**
- `attendance_records` — registro original do encontro (inclusive faltas, que **permanecem como
  falta** mesmo após uma reposição ser validada), `attendance_change_history`.
- `meeting_equivalences` — continua existindo para descrever quais encontros são
  academicamente equivalentes entre si (para fins de composição das opções de reposição
  oferecidas ao aluno).
- `makeup_requests` — solicitação de reposição (ausência de origem, opção de destino, status).
- **`attendance_makeup_credits`** *(reformulada em relação a `makeup_attendance`)*: `id`,
  `original_attendance_record_id` (aponta para a falta), `makeup_meeting_id` (encontro de
  reposição efetivamente cursado), `recognized_minutes`, `status`
  (`aguardando_validacao`/`validado`), `validated_by`, `validated_at`. Constraint de aplicação/
  banco: `recognized_minutes` nunca pode exceder os minutos perdidos na falta de origem
  (descontados créditos já concedidos para a mesma falta).
- **Frequência reconhecida da matrícula** = `SUM(minutos de presença direta em attendance_records)
  + SUM(recognized_minutes de attendance_makeup_credits com status = validado)`.

**Certificados**
- `certificate_templates`.
- **`certificate_signatories`** *(nova entidade)*: `id`, `name`, `role_title`,
  `signature_image_url`, `order`, `valid_from`, `valid_until`, `active`.
- `certificates` — além dos campos já previstos (aluno, matrícula ou formação completa, código,
  QR Code, data de emissão, status, arquivo PDF, invalidado em, motivo), ganha
  `signatories_snapshot jsonb`, gravado no momento da emissão a partir de
  `certificate_signatories` — o certificado permanece correto mesmo que o signatário mude depois.
- `formation_status`.

**Comunicação**
`announcements`, `announcement_targets`, `notifications`, `notification_reads`, `email_logs`.

**Auditoria e importação**
- `audit_logs` — `usuário`, `ação`, `entidade`, `entidade_id`, `valor anterior`, `valor novo`,
  `justificativa`, `data`. Preenchida majoritariamente por **triggers `AFTER UPDATE/DELETE`** nas
  tabelas sensíveis (`enrollments`, `attendance_records`, notas em `assessment_attempts`,
  `certificates`, `user_roles`, `contents` publicados) — capturando `OLD`/`NEW` automaticamente,
  como defesa em profundidade mesmo que uma escrita não passe pela camada de serviço TypeScript.
  `responsável`/`justificativa` (contexto que o trigger não vê sozinho) são propagados via
  variável de sessão Postgres (`SET LOCAL app.actor_id`, `SET LOCAL app.justification`), definida
  pela Server Action/função RPC antes de qualquer escrita sensível.
- `imports`, `import_rows`.

**Tarefas assíncronas**
- `jobs` — implementação inicial da interface `AsyncTaskQueue` (seção 5): `id`, `type`,
  `payload jsonb`, `status`, `attempts`, `last_error`, `run_after`, `locked_at`, `created_at`.

**Restrições estruturais obrigatórias**
- E-mail único por usuário (garantido pelo próprio `auth.users`).
- Um professor só acessa turmas com `teacher_assignment` correspondente — nunca via `user_roles`.
- Um aluno só acessa conteúdo de matrícula autorizada e ativa.
- Nota e frequência nunca são sobrescritas sem registro em `audit_logs` (via trigger, ver acima).
- Certificado possui código único (constraint `UNIQUE`).
- Questões de recuperação são disjuntas do conjunto usado na avaliação regular (validado na
  função Postgres que monta `assessment_questions`).
- Snapshot de tentativa de avaliação (`assessment_attempt_questions`) é imutável após criado.
- Conjunto de elegíveis (`assessment_eligible_students`) é imutável após a publicação/liberação.
- Crédito de reposição nunca excede os minutos perdidos na falta de origem.
- Exclusões acadêmicas relevantes preferem arquivamento lógico (`status = archived`) a `DELETE`.
- Nenhum dado financeiro no escopo acadêmico do MVP (não há tabela de pagamento).
- **Row Level Security ativa em toda tabela listada acima que é exposta pela API do Supabase**,
  com políticas específicas por perfil e vínculo (detalhadas na Fase 1, junto das migrations).

---

## 9. Relações entre as principais entidades

```text
auth.users 1:1 Profile
Profile 1:N Enrollment
Profile N:N Role (via user_roles — sempre global, sem escopo)
Profile 1:N TeacherAssignment N:1 Class            (única fonte do escopo do professor)

Volume 1:N Module
Module 1:N Lesson

Season 1:N SeasonVolumeOffering N:1 Volume
SeasonVolumeOffering 1:N Class
Class 1:N ClassMeeting
Class N:1 ClassTemplate

Enrollment N:1 SeasonVolumeOffering
Enrollment N:1 Class (turma principal, pertence à mesma oferta)
Enrollment 1:N AttendanceRecord
Enrollment 1:N AttendanceMakeupCredit (via AttendanceRecord de origem)
Enrollment 1:N ContentProgress
Enrollment 1:N ActivityAttempt
Enrollment 1:N AssessmentAttempt
Enrollment 1:N MakeupRequest
Enrollment 1:N Certificate
Enrollment 1:1 RecoveryPath (quando aplicável)

Lesson 1:N Content
Content 1:1 VideoContent (quando tipo = vídeo)
Content 1:N ReleaseRule

Assessment N:1 SeasonVolumeOffering
Assessment 1:N AssessmentQuestion N:1 QuestionBank
Assessment 1:N AssessmentEligibleStudent N:1 Enrollment   (conjunto fixo, no momento da liberação)
AssessmentAttempt 1:N AssessmentAttemptQuestion            (snapshot imutável, criado ao iniciar)
Activity 1:N ActivityQuestion N:1 QuestionBank

AttendanceRecord 1:N AttendanceMakeupCredit (falta de origem → créditos)
ClassMeeting 1:N AttendanceMakeupCredit (encontro de reposição → créditos)

Certificate N:1 CertificateSignatory (via signatories_snapshot, congelado na emissão)
Profile(formação completa) 1:1 FormationStatus
```

---

## 10. Estratégia de autenticação e autorização

**Autenticação (Supabase Auth)**
- Conta criada apenas por convite — `supabase.auth.admin.inviteUserByEmail`, disparado pela
  coordenação/administração — nunca autocadastro público.
- SMTP customizado do Supabase Auth aponta para o Titan institucional (`makarios@igrejaemaus.com.br`),
  usado nos e-mails nativos de convite, primeiro acesso, recuperação de senha e mensagens de
  segurança — configurado no painel do Supabase, credenciais fora do código.
- Fluxo: convite por e-mail → aluno/professor cria senha → aceite de termos → primeiro acesso.
- Senha com hash gerenciado internamente pelo Supabase Auth; a aplicação nunca manipula senha em
  texto plano.
- Sessão gerenciada por Supabase Auth + `@supabase/ssr` (integração oficial com Next.js/SSR,
  cookies httpOnly, refresh token rotacionável); "encerramento de sessões" usa a API
  administrativa do Supabase Auth, exposta na tela `ADM-01`.
- Bloqueio de usuário combina duas ações: `profiles.status = suspended` (perfil interno da
  aplicação) **e** revogação de sessão/bloqueio no Supabase Auth — a checagem de `status`
  acontece tanto em RLS (política nega acesso se `status != active`) quanto na camada de
  políticas em código.
- **Identidade vs. autorização acadêmica**: `auth.users`/Supabase Auth resolve *quem* é o
  usuário; `profiles` → `user_roles` → `roles` (perfis globais) + `teacher_assignments` (escopo
  de professor) resolvem *o que* ele pode fazer — são camadas propositalmente separadas.

**Autorização**
- **RLS (Postgres)** — primeira linha de defesa, ativa em toda tabela exposta; políticas
  verificam `auth.uid()` contra o dono do recurso ou contra um vínculo (ex.: existe
  `teacher_assignment` ligando este professor a esta turma?).
- **Camada de políticas tipada (TypeScript)** — chamada em toda Server Action/Route Handler antes
  de qualquer leitura/escrita sensível; para operações que cruzam múltiplas tabelas e exigem
  atomicidade, a política aciona uma **função Postgres via RPC** que reaplica as mesmas checagens
  dentro da transação (nunca confia apenas na política do lado do Next.js).
- Zod valida **forma** dos dados de entrada (tipo, obrigatoriedade, formato); nunca decide se uma
  operação é permitida.
- CASL é uma alternativa possível à camada de políticas tipada caso a matriz recurso×ação cresça
  muito — não adotado como padrão inicial (ver seção 23).
- UI usa o resultado da autorização apenas para exibir/ocultar (experiência); o backend e o banco
  repetem a checagem de forma independente em toda operação.
- Testes automatizados de autorização por perfil (matriz da seção 3) e de políticas de RLS fazem
  parte da suíte de CI.

---

## 11. Estratégia para múltiplos perfis na mesma conta

- Um `profile` pode ter N linhas em `user_roles` — **sempre globais** (sem `class_id`/
  `volume_id`); múltiplos perfis (ex.: aluno + professor) coexistem sem duplicar conta.
- O vínculo de professor com turmas específicas nunca é modelado em `user_roles` — vem sempre de
  `teacher_assignments`, consultado no momento da autorização, independentemente de qual perfil
  está ativo.
- No login, se a conta tem mais de um perfil, exibe-se a tela `AUT-04` (Seleção de perfil); o
  perfil escolhido vira o **perfil ativo da sessão**.
- A troca de perfil (ex.: alguém que é aluno e também professor) não gera nova conta nem nova
  sessão de autenticação — apenas atualiza o contexto de autorização da sessão atual.
- Toda política de autorização recebe `(userId, activeRole, requestedResource)`; se o
  `activeRole` não tiver o vínculo necessário sobre o recurso (checado contra
  `teacher_assignments` quando `activeRole = teacher`), a operação é negada mesmo que o usuário
  possua outro perfil que teria acesso — evita confusão de contexto (ex.: editar nota "sendo
  aluno sem querer").

---

## 12. Estratégia para vídeos não listados do YouTube e registro de progresso

- Vídeo cadastrado com `youtube_video_id`, mas o player é sempre acessado por uma rota da
  aplicação (`/aula/:id/video`), nunca por link direto ao YouTube — reduz (não elimina)
  exposição casual do link, conforme limitação aceita no doc 06.
- Antes de renderizar o `<iframe>`, o servidor valida que o usuário tem matrícula ativa e
  autorizada para aquele conteúdo — se não tiver, nenhum ID de vídeo é enviado ao cliente.
- Player usa a **YouTube IFrame Player API** no client; eventos (`onStateChange`, posição via
  `getCurrentTime()`) são amostrados periodicamente (ex.: a cada 10s, em pausa e ao final).
- Cliente envia pings de progresso para um endpoint autenticado; servidor faz `upsert` em
  `content_progress` (idempotente por matrícula+conteúdo), atualizando `started_at`,
  `last_position`, `percent`, e marcando `completed_at` quando `percent >= threshold`
  (padrão 80%, configurável por conteúdo via `video_contents.min_percent`).
- `content_progress` tem RLS própria: cada matrícula só pode `upsert` a própria linha — defesa
  adicional mesmo que o endpoint de progresso seja chamado fora do fluxo esperado.
- Não há validação de "assistiu de verdade" além do percentual reportado pelo player — limitação
  aceita explicitamente pelo doc 06 (YouTube não listado "não oferece proteção absoluta").

---

## 13. Estratégia para exercícios, avaliações, cronômetro e recuperação

- **Exercícios (`activities`)**: nunca geram nota; podem ter `blocks_progress = true` (impede
  avançar sem enviar) e `max_attempts` (nulo = ilimitado); resultado e explicação exibidos
  conforme configuração do conteúdo.
- **Avaliação (`assessments`)**: criada pela coordenação/editor, vinculada a uma
  `season_volume_offering`, com 20 questões (padrão), peso configurável, embaralhamento opcional.
- **Elegibilidade de abertura**: calculada na camada de serviço a partir das condições do doc 02
  (aulas concluídas, data, exercícios/conteúdos obrigatórios concluídos, ou liberação manual).
- **Conjunto fixo de elegíveis**: ao publicar/liberar a avaliação, uma função Postgres grava em
  `assessment_eligible_students` todas as matrículas que, naquele momento, estão ativas,
  autorizadas, não canceladas/desistentes e vinculadas à oferta/avaliação. Esse conjunto **não é
  recalculado depois** — uma matrícula criada posteriormente não entra nele e não atrasa a
  liberação do gabarito.
- **Início da tentativa e snapshot imutável**: `fn_start_assessment_attempt(enrollment_id,
  assessment_id)` roda como uma única transação Postgres que (1) valida elegibilidade e ausência
  de tentativa anterior, (2) seleciona as questões e embaralha conforme configuração, (3) grava
  uma linha por questão em `assessment_attempt_questions` (posição, ordem das alternativas,
  valor, resposta correta vigente naquele instante) e (4) cria `assessment_attempts` com
  `started_at`. A partir daí, alterações futuras no banco de questões **não afetam** a prova já
  iniciada — a correção sempre lê o snapshot, nunca o `question_bank` atual.
- **Cronômetro server-authoritative**: `deadline = started_at + duration`, calculado no servidor.
  O cliente exibe cronômetro local só para UX; toda escrita de resposta é validada contra
  `deadline` no servidor. O `pg_cron` (Supabase Cron) roda a cada minuto uma função Postgres que
  encerra tentativas com `deadline` vencido e ainda `in_progress`, marca `submitted_at` e
  enfileira a correção (via `AsyncTaskQueue`, se a correção não for feita inline) — cobre quedas
  de conexão sem depender do relógio do navegador, e roda direto no banco, sem precisar de uma
  função Netlify.
- **Autosave**: cada resposta é persistida via requisição incremental (debounce curto no
  cliente); não há "salvar tudo no fim" que arrisque perda de dados.
- **Correção automática**: 100% objetiva (múltipla escolha, V/F, associação, ordenação,
  preenchimento com opções), comparando a resposta contra o `correct_answer_snapshot` da própria
  tentativa — nunca há fila de correção manual, por restrição explícita do usuário.
- **Gabarito**: liberado quando o primeiro evento ocorrer entre — todos os `enrollment_id` de
  `assessment_eligible_students` enviaram / prazo encerrado / liberação manual.
- **Recuperação**: `recovery_paths` vincula a matrícula a uma trilha de revisão obrigatória
  (`recovery_path_items`); a tentativa de recuperação só abre quando todos os itens da trilha
  estão concluídos. Questões selecionadas de um subconjunto disjunto do usado na avaliação
  regular daquele volume/oferta (validado na função Postgres que monta a prova). Também gera seu
  próprio snapshot imutável, pelo mesmo mecanismo. Nota final = `MAX(nota_regular,
  nota_recuperacao)`, com histórico completo preservado.
- **Tentativa excepcional**: sempre uma ação manual da coordenação, obrigatoriamente registrada
  em `audit_logs` (via trigger) com justificativa.

---

## 14. Estratégia para frequência e equivalência de reposições

- Cada `class_meeting` carrega `academic_minutes` pré-calculado a partir do `class_template`
  (ex.: bloco 19h30–20h30 + bloco 20h50–21h50 = 120 min; intervalo 20h30–20h50 excluído).
- `attendance_records` grava por matrícula+encontro: `status` (presente/ausente/atrasado/
  parcial/justificada/reposição/pendente) e, quando `parcial`, `recognized_minutes` explícito.
  **Esse registro é o histórico da presença naquele encontro específico e nunca é reescrito por
  causa de uma reposição** — se o aluno faltou, o registro continua dizendo que faltou.
- **Reposição como crédito separado**: quando a coordenação valida uma reposição, o sistema cria
  uma linha em `attendance_makeup_credits` apontando para (a) a `attendance_record` da falta de
  origem e (b) o `class_meeting` onde a reposição foi cursada, com `recognized_minutes` explícito.
  Uma função Postgres (`fn_validate_makeup_credit`) garante, dentro da mesma transação, que a
  soma de créditos já concedidos para aquela falta nunca ultrapasse os minutos perdidos nela.
- **Percentual da matrícula** = `(SUM(minutos de presença direta) + SUM(recognized_minutes de
  créditos com status = validado)) / total_academic_minutes do volume` (960 min = 16h), calculado
  sob demanda por função pura testável — pode ser materializado em `enrollment_progress` como
  cache, recalculado a cada alteração.
- Toda alteração de frequência (registro original ou crédito de reposição) grava em
  `attendance_change_history` (valor anterior, novo, responsável, justificativa, data) — nunca é
  um `UPDATE` silencioso.
- `makeup_requests` continua descrevendo o ciclo de vida da solicitação (necessária → opções
  disponíveis → solicitada → em análise → aprovada/recusada → realizada → aguardando validação →
  validada), mas seu desfecho é a criação de um `attendance_makeup_credit` — nunca a alteração
  direta do `attendance_record` original.

---

## 15. Estratégia para importação de planilhas XLSX e CSV

Wizard de 10 passos conforme `06-integracoes-e-requisitos-tecnicos.md` seção 5:

1. Upload (validação de tipo/tamanho) → arquivo salvo no bucket `imports` do Supabase Storage,
   registro em `imports`.
2. Detecção de cabeçalhos e proposta automática de mapeamento de colunas
   (nome, e-mail, telefone, nascimento, volume, temporada, turma, status, autorizado,
   observações).
3. Usuário confirma/ajusta o mapeamento.
4. Validação por linha (formato de e-mail, campos obrigatórios, oferta de volume/turma
   existentes) — processada **em background** (via `AsyncTaskQueue`, executado por uma Netlify
   Background Function) para não travar a interface em planilhas grandes.
5. Detecção de duplicidade (e-mail já cadastrado; combinação aluno+oferta de volume já
   matriculada).
6. Pré-visualização com contagem de linhas válidas/erros antes de confirmar.
7. Confirmação dispara processamento em lote (task assíncrona), com progresso consultável.
8. Cada linha grava resultado em `import_rows` (status, erros, `user_id` criado,
   `enrollment_id` criado) — permite retomar/auditar linha a linha.
9. Convites disparados apenas para usuários novos criados com sucesso (via Supabase Auth
   `inviteUserByEmail`, usando o SMTP Titan configurado).
10. Relatório final na UI com contagem de sucesso/erro e botão para baixar CSV apenas das linhas
    com erro, para correção e reenvio.

---

## 16. Estratégia para integração de e-mail Titan via SMTP

O envio de e-mail é dividido em dois caminhos, conforme a natureza da mensagem:

**E-mails de autenticação (nativos do Supabase Auth)**
- Convite, primeiro acesso, recuperação de senha e mensagens de segurança são enviados pelo
  próprio Supabase Auth, configurado para usar o **SMTP customizado do Titan**
  (`makarios@igrejaemaus.com.br`) no painel do projeto — credenciais armazenadas apenas no
  painel seguro do Supabase, nunca no código.

**E-mails institucionais (camada própria, server-side)**
- Comunicados, abertura de avaliação, reposição, certificado emitido e notificações gerais usam
  uma camada própria: transport Nodemailer configurado 100% por variáveis de ambiente
  (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`,
  `SMTP_FROM_EMAIL`, `SMTP_REPLY_TO`) — nunca hardcoded, nunca versionado.
- Todo envio passa pela `AsyncTaskQueue` (tabela `jobs`, processada por uma Netlify Background
  Function), não por chamada síncrona na requisição HTTP — garante retry com backoff em caso de
  falha temporária do Titan.
- Templates transacionais em React Email (renderizados a HTML).
- `email_logs` registra destinatário, tipo, status (enviado/falhou), erro e timestamp — usado
  tanto para auditoria quanto para o dashboard de "falhas de envio de e-mail" exigido no doc 06.
- Função de **teste de envio** exposta no painel administrativo (`ADM-03`), restrita a
  administrador, que dispara um e-mail de teste e reporta sucesso/erro.

---

## 17. Estratégia para geração e validação pública de certificados

- Template do certificado reconstruído a partir do arquivo de referência (moldura azul
  pontilhada, logo `makarios escola`, fita com ícone de folha, logo `EMAÚS`, blocos de
  assinatura), exportado como imagem/PDF base de alta resolução.
- **Signatários configuráveis**: `certificate_signatories` guarda nome, cargo, imagem de
  assinatura, ordem e período de validade de cada signatário (ex.: Diretor da Escola Makários,
  Pastor Sênior da Igreja Emaús); nada disso fica fixo no código. No momento da emissão, os dados
  vigentes são copiados para `certificates.signatories_snapshot`, garantindo que o PDF gerado
  permaneça correto mesmo que a configuração de signatários mude depois.
- Geração via `pdf-lib`, sobrepondo no template base: nome do aluno, volume/formação, temporada,
  cargas horárias, data, código de validação, QR Code e os dados do `signatories_snapshot`.
- Ao gerar: código de validação único (`certificates.code`, `UNIQUE`) + QR Code (`qrcode`)
  apontando para `/certificados/validar/{code}`; PDF salvo no bucket **privado**
  `generated-certificates` do Supabase Storage, acessível apenas via URL assinada de curta
  duração para o dono do certificado autenticado (ou coordenação/admin).
- Reemissão gera novo PDF preservando o mesmo código, registrada em `audit_logs` (via trigger).
- Invalidação seta `certificates.status = invalidated` + `motivo`, sempre auditada; a página
  pública passa a informar que o certificado não é mais válido.
- **Página pública de validação** (`PUB-01`), servida por uma rota Next.js no Netlify: sem
  autenticação, rate-limited, consulta apenas uma **view/RPC pública restrita** no Supabase (role
  `anon`, protegida por RLS) que expõe somente os campos permitidos pelo doc 04 (nome, tipo de
  certificado, volume, data, carga horária, validade, Escola Makários, Igreja Emaús). Essa rota
  **nunca** expõe o bucket privado de certificados nem qualquer dado administrativo/financeiro.
- **Pendência de dados reais**: o modelo fornecido corresponde ao certificado de **formação
  completa**; o certificado **por volume** ainda não tem um modelo visual próprio fornecido —
  será derivado do mesmo template/tokens até que um modelo específico seja entregue (seção 22).

---

## 18. Estrutura proposta de pastas do projeto

Projeto único, sem monorepo. `makarios-docs/` (documentação e ativos de marca) permanece como já
está, na raiz do repositório.

```text
makarios-system/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (public)/                # login, primeiro acesso, validação pública de certificado
│   │   ├── (aluno)/                 # dashboard, volumes, aula, avaliação...
│   │   ├── (professor)/
│   │   ├── (coordenacao-admin)/
│   │   ├── (conteudo)/              # estúdio de conteúdo (editor + coordenação/admin)
│   │   └── api/                     # route handlers (webhooks, endpoints fora de Server Actions)
│   ├── components/
│   │   ├── ui/                      # shadcn/ui + design system Makários
│   │   └── domain/                  # player, cronômetro, wizard de import...
│   ├── modules/                     # organização por domínio de negócio (matrícula, frequência,
│   │                                 # avaliação, reposição, certificado...), cada um com suas
│   │                                 # Server Actions + tipos, chamando services/
│   ├── services/                    # regras de negócio puras e testáveis (sem HTTP, sem RLS)
│   ├── authorization/               # camada de políticas tipada (RBAC + escopo)
│   ├── jobs/                        # implementação de AsyncTaskQueue (adapter atual: tabela
│   │                                 # `jobs` via Supabase) + handlers por tipo de tarefa
│   ├── integrations/
│   │   ├── supabase/                 # clients (browser, server, admin/service-role), tipos gerados
│   │   ├── titan/                    # Nodemailer + templates React Email
│   │   └── youtube/                  # integração IFrame API (client) + tracking (server)
│   └── lib/                          # utilidades genéricas
├── supabase/
│   ├── migrations/                   # SQL versionado (schema, RLS, triggers, funções)
│   ├── functions/                    # Supabase Edge Functions (quando necessárias)
│   └── seed.sql                      # dados de desenvolvimento (fictícios, nunca reais)
├── netlify/
│   └── functions/                    # Scheduled Functions (varrer `jobs`, gatilhos leves) e
│                                      # Background Functions (e-mail, PDF, import XLSX/CSV)
├── makarios-docs/                    # (existente) documentação e identidade visual — inalterado
├── public/
├── tests/
├── netlify.toml
└── .github/workflows/                # CI (lint, typecheck, test, build) — gate antes do merge
```

---

## 19. Variáveis de ambiente necessárias

```env
# Aplicação
APP_URL=
CERTIFICATE_PUBLIC_BASE_URL=       # base da URL usada no QR Code (ex.: https://plataforma.../certificados/validar)

# Supabase (variáveis do app, configuradas no painel do Netlify)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=               # server-only — nunca exposta ao cliente, usada só em
                                    # Netlify Functions/Server Actions que precisam bypassar RLS
                                    # de forma controlada (ex.: convite administrativo)

# Storage (nomes de bucket, se não fixados por convenção no código)
SUPABASE_STORAGE_BUCKET_COURSE_MATERIALS=
SUPABASE_STORAGE_BUCKET_TEACHER_MATERIALS=
SUPABASE_STORAGE_BUCKET_CERTIFICATE_TEMPLATES=
SUPABASE_STORAGE_BUCKET_GENERATED_CERTIFICATES=
SUPABASE_STORAGE_BUCKET_IMPORTS=

# SMTP Titan (e-mails institucionais enviados pela aplicação)
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=makarios@igrejaemaus.com.br
SMTP_PASSWORD=
SMTP_FROM_NAME=Escola Makários | Igreja Emaús
SMTP_FROM_EMAIL=makarios@igrejaemaus.com.br
SMTP_REPLY_TO=makarios@igrejaemaus.com.br

# Regras acadêmicas padrão (podem também ficar em tabela de configuração — ver seção 23)
DEFAULT_VIDEO_COMPLETION_PERCENT=80
DEFAULT_ASSESSMENT_QUESTIONS=20
DEFAULT_ASSESSMENT_DURATION_MINUTES=60
DEFAULT_ASSESSMENT_WINDOW_DAYS=14
DEFAULT_PASSING_GRADE=6
DEFAULT_MIN_ATTENDANCE_PERCENT=75
```

Observações:
- O SMTP do Titan usado **pelo Supabase Auth** (e-mails de convite/reset nativos) é configurado
  separadamente, no **painel do Supabase** (Auth → SMTP Settings) — não é uma variável de
  ambiente do Next.js/Netlify.
- Para aplicar migrations em CI/CD (GitHub Actions → projeto Supabase de homologação/produção),
  é necessária uma connection string de banco (`SUPABASE_DB_URL` ou equivalente) — essa variável
  fica **apenas como secret do GitHub Actions**, nunca no `.env` do app nem no painel do Netlify.
- Nenhum segredo é versionado no GitHub; cada ambiente (local/homologação/produção) usa seu
  próprio projeto Supabase e seu próprio conjunto de variáveis no Netlify.

---

## 20. Roadmap de implementação (fases)

| Fase | Escopo | Base documental |
|---|---|---|
| **0 — Planejamento técnico** | Este documento. Nenhum código de produção. | Todos os docs |
| **1 — Fundação** | Projeto Next.js único; Supabase local/dev (`auth.users`→`profiles`→`user_roles`→`roles`); migrations + RLS iniciais; convite/login/recuperação via Supabase Auth; múltiplos perfis; camada de políticas tipada; `AsyncTaskQueue` com adapter simples (tabela `jobs`); design system; auditoria via triggers. **Apenas o ambiente local de desenvolvimento é obrigatório nesta fase.** | 06, 07 §3 |
| **2 — Administração acadêmica** | Volumes, temporadas, `season_volume_offerings`, turmas, modelos de horário, encontros, professores (`teacher_assignments`), alunos, matrículas, pré-requisitos/exceções, importação XLSX/CSV | 05, 06 §5, 07 §4 |
| **3 — Conteúdo e área do aluno** | Módulos, aulas, conteúdos, arquivos (Supabase Storage), YouTube, regras de liberação, dashboard/volumes/aula/progresso/exercícios/agenda do aluno | 05, 06 §2, 07 §5 |
| **4 — Área do professor** | Dashboard, agenda, turmas (via `teacher_assignments`), preparação de aula, materiais, frequência, relatório pós-aula | 03, 04, 07 §6 |
| **5 — Avaliações e recuperação** | Banco de questões, construtor de exercício, avaliação final, snapshot imutável por tentativa, conjunto fixo de elegíveis, cronômetro (pg_cron), autosave, correção automática, gabarito, trilha de revisão, recuperação, tentativa excepcional | 02 §5-8, 06 §9, 07 §7 |
| **6 — Frequência e reposição** | Cálculo por minutos, `attendance_makeup_credits` (crédito separado), solicitação, análise, reposição futura, validação, regularização | 02 §9-11, 07 §8 |
| **7 — Certificados e comunicação** | SMTP Titan (Auth + institucional), convites, notificações, comunicados, `certificate_signatories`, certificado de volume, certificado completo, QR Code, validação pública | 02 §13, 06 §3/§6, 07 §9 |
| **8 — Dashboards, relatórios e estabilização** | Indicadores, filtros, relatórios PDF/planilha, auditoria completa, testes (incluindo RLS), acessibilidade, performance, backup, preparação de homologação e produção | 04 §5, 06 §11-13, 07 §10 |

**Ambientes ao longo do roadmap** (ver seção 5/23): a Fase 1 exige apenas o ambiente local de
desenvolvimento (Supabase local ou projeto de desenvolvimento na nuvem + Netlify Dev). Um
**projeto Supabase de homologação** deve ser criado e populado com dados fictícios **antes do
piloto** (transição das Fases 6→7, quando o fluxo completo passa a ser testado ponta a ponta). Um
**projeto Supabase de produção**, isolado e com dados reais, deve ser criado e configurado **antes
de qualquer uso com alunos reais** (o mais tardar ao final da Fase 8, antes do go-live).

Cada fase só inicia após a anterior atender seus critérios de conclusão (seção 21) e ser validada
funcionalmente pelo usuário.

---

## 21. Critérios de conclusão de cada fase

- **Fase 1**: usuário só acessa recursos permitidos (testado tanto via UI/Server Action quanto
  via chamada direta simulando acesso à API do Supabase, validando RLS); mesma conta alterna
  entre perfis sem duplicar cadastro; escopo de professor funciona exclusivamente via
  `teacher_assignments`; nenhuma credencial no código-fonte; telas básicas funcionam em celular;
  `AsyncTaskQueue` processa ao menos uma tarefa de ponta a ponta (ex.: e-mail de teste) usando o
  adapter simples; ambiente local de desenvolvimento funcional (homologação/produção não são
  exigidas nesta fase).
- **Fase 2**: é possível criar a temporada 2026.2, os três volumes, uma `season_volume_offering`
  por volume, uma turma terça/quinta e uma turma sábado (com os horários do doc 08), matricular
  um aluno em dois volumes simultâneos, bloquear um pré-requisito e liberar exceção auditada, e
  importar uma planilha exibindo relatório de erros por linha.
- **Fase 3**: aluno só vê conteúdo de matrícula autorizada; conteúdo libera gradualmente
  conforme regra configurada; progresso de vídeo persiste corretamente (RLS impede escrever
  progresso de outra matrícula); exercício obrigatório não altera média nem some da UI
  silenciosamente; conteúdo complementar não bloqueia conclusão; volume concluído continua
  acessível.
- **Fase 4**: professor só vê suas turmas/alunos (RLS + `teacher_assignments`); registra presença
  e presença parcial; não consegue editar conteúdo (nem via API); não vê dado financeiro;
  relatório pós-aula chega à coordenação.
- **Fase 5**: avaliação usa 20 questões/60 min/14 dias; nenhuma questão discursiva; snapshot da
  tentativa é criado ao iniciar e permanece inalterado mesmo que o banco de questões mude depois;
  cronômetro resiste a queda de conexão (pg_cron força submissão no prazo); conjunto de elegíveis
  é fixado na liberação e matrícula tardia não bloqueia o gabarito; recuperação usa banco disjunto
  da avaliação regular; nota final é sempre o maior valor.
- **Fase 6**: 12 de 16h resulta corretamente em 75%; intervalo não conta na carga; a falta
  original nunca é convertida em presença — a reposição gera um crédito separado, limitado à
  carga perdida, que só entra na frequência reconhecida após validação; toda alteração é auditada
  com valor anterior/novo.
- **Fase 7**: e-mails de autenticação saem pelo Titan via Supabase Auth; e-mails institucionais
  saem pela camada própria, também via Titan; senha SMTP nunca aparece no repositório;
  certificado só é liberado após validação de aprovação; signatários vêm de configuração, não de
  texto fixo no código; certificado emitido preserva o snapshot do signatário mesmo se a
  configuração mudar depois; ausência em formatura não bloqueia o certificado completo; código
  público valida autenticidade corretamente (inclusive para certificado invalidado) sem expor o
  bucket privado.
- **Fase 8**: dashboards usam dados reais (não mock); relatórios respeitam os filtros aplicados;
  toda ação crítica listada na seção 4.13 aparece na auditoria (verificado inclusive para escritas
  que tentem contornar a camada de aplicação); fluxos principais de aluno e professor funcionam em
  celular; nenhuma permissão depende apenas de ocultação visual; suíte de testes cobre os cálculos
  acadêmicos críticos e as políticas de RLS mais sensíveis; projeto de homologação populado e
  validado; projeto de produção criado, isolado e pronto antes do uso com alunos reais.

---

## 22. Riscos técnicos e limitações conhecidas

- **Proteção de vídeo do YouTube não listado é limitada** — link pode ser compartilhado fora da
  plataforma; aceito explicitamente pelo doc 06, mas deve ser comunicado à coordenação como
  limitação, não como falha do sistema.
- **Deliverabilidade do SMTP Titan** — provedores corporativos por vezes têm limites de envio por
  hora/dia; comunicados em massa (ex.: toda uma temporada) precisam de throttling na
  `AsyncTaskQueue` para evitar bloqueio temporário da conta de e-mail; isso vale tanto para os
  e-mails institucionais quanto, indiretamente, para os e-mails de autenticação enviados pelo
  Supabase Auth com o mesmo SMTP.
- **Cronômetro depende do `pg_cron` rodar no intervalo configurado** — se a execução agendada
  atrasar, tentativas vencidas podem não ser encerradas exatamente no minuto do prazo; a validação
  real do prazo continua sendo feita a cada escrita de resposta, então não há risco de nota
  indevida, apenas de atraso no fechamento automático. Precisa de monitoramento dedicado na Fase 8.
- **Limites de execução de funções serverless (Netlify)** — Background Functions têm um teto de
  tempo de execução finito; importações de planilhas muito grandes ou lotes grandes de e-mail
  podem precisar ser fatiados em múltiplas tarefas (`jobs`) em vez de uma única monolítica —
  desenhado nas Fases 2 (import) e 7 (comunicados em massa).
- **Row Level Security exige disciplina de teste** — políticas mal escritas podem tanto vazar
  dados (política permissiva demais) quanto quebrar funcionalidades legítimas (política restritiva
  demais); cada tabela sensível precisa de teste automatizado da própria política, não só da
  lógica de aplicação (ver pgTAP/testes de integração na seção 23).
- **Funções PostgreSQL/RPC concentram lógica crítica no banco** — exige disciplina de versionamento
  (toda função vive em uma migration, nunca só no Dashboard) e testes próprios; a curva de
  manutenção é diferente de "só TypeScript", e a equipe precisa estar confortável com `plpgsql`
  para as operações mais sensíveis (aprovação, certificado, snapshot de avaliação, crédito de
  reposição).
- **Ausência de ORM implica maior responsabilidade dos tipos gerados** — os tipos TypeScript
  gerados via `supabase gen types typescript` precisam ser regenerados a cada migration; um
  esquecimento faz o app compilar contra um schema desatualizado sem erro imediato. Recomenda-se
  automatizar essa regeneração no CI.
- **Crescimento de armazenamento pelo snapshot de avaliação** — gravar uma linha por questão por
  tentativa (`assessment_attempt_questions`) é mais dado do que reaproveitar `question_bank`
  diretamente; aceitável no volume esperado (uma instituição, poucas centenas de tentativas por
  temporada), mas deve ser observado se o volume crescer.
- **Geração de PDF com `pdf-lib` exige mapeamento manual de coordenadas** sobre uma imagem/PDF
  base do certificado — menos flexível que renderizar HTML/CSS diretamente; qualquer ajuste fino
  de layout do certificado exige reexportar o template base e reajustar coordenadas no código.
- **Certificado de volume ainda não tem modelo visual próprio** — apenas o modelo de "formação
  completa" foi fornecido (`certificate/MAKARIOS CERTIFICADO SEM NOME.pdf.pdf`); o layout do
  certificado por volume será derivado do mesmo sistema de tokens até que a coordenação forneça
  um modelo específico (ou confirme que o mesmo modelo serve para ambos, trocando apenas o texto).
- **Fonte da marca ("Heuvel Grotesk")** — não é uma fonte open-source amplamente disponível; será
  necessário confirmar licenciamento de uso web ou escolher uma fonte geometricamente próxima
  como substituta até a definição.
- **Importação de planilhas com dados reais de alunos** envolve dados pessoais sensíveis (LGPD);
  a Fase 2 precisa implementar controle de acesso e retenção adequados antes de qualquer
  importação real ser realizada em produção.
- **Ambiguidade estrutural**: o README (`00-README.md`) sugere `/brand` e `/certificate` na raiz
  do projeto, mas os arquivos reais estão em `makarios-docs/brand/` e `makarios-docs/certificate/`
  — este plano segue os caminhos reais; `makarios-docs/` permanece como está, na raiz do
  repositório de código.

---

## 23. Decisões técnicas que ainda precisam ser tomadas

> Infraestrutura (GitHub + Netlify + Supabase + Titan), ausência de Prisma/Redis/BullMQ no MVP,
> estrutura de projeto único, `season_volume_offerings`, snapshot imutável de avaliação, conjunto
> fixo de elegíveis, reposição como crédito separado e signatários configuráveis já foram
> decididos com o usuário nesta etapa. Itens abaixo permanecem em aberto:

1. **Supabase local (`supabase start` via Docker) vs. projeto Supabase de desenvolvimento na
   nuvem** para o ambiente local da Fase 1 — impacta velocidade de iteração e paridade com
   produção. Definir no início da Fase 1.
2. **Ferramenta de teste para políticas de RLS**: pgTAP (testa dentro do próprio Postgres) vs.
   testes de integração via `supabase-js` contra um projeto local (mais simples de escrever em
   TypeScript, um pouco mais distante do banco). Definir junto com a primeira leva de políticas.
3. **Limite a partir do qual a camada de políticas tipada deveria evoluir para CASL** (ou
   permanecer customizada) — não é uma decisão urgente, mas deve ser revisitada se a matriz de
   recurso×ação crescer significativamente ao longo das Fases 2–5.
4. **Plano do Netlify necessário**: Background Functions e limites de execução mais altos podem
   exigir um tier pago — confirmar necessidade real de custo antes da Fase 7 (quando e-mail em
   massa e geração de PDF entram em produção).
5. **Licenciamento/uso da fonte "Heuvel Grotesk"** e confirmação da paleta de cores exata (azul e
   creme extraídos das artes fornecidas) como tokens formais de design system.
6. **Modelo visual do certificado por volume** (distinto do certificado de formação completa) —
   aguardando confirmação/entrega da coordenação; necessário também para calibrar as coordenadas
   do `pdf-lib`.
7. **Carga horária online oficial** por volume — explicitamente marcada como "a definir" no
   doc 08; necessária antes de fechar o cálculo total de carga exibido no certificado.
8. **Textos finais e assinaturas oficiais dos certificados** — o modelo fornecido tem assinaturas
   de exemplo; confirmar nomes/cargos definitivos (que alimentarão `certificate_signatories`)
   antes da Fase 7.
9. **Política de retenção/anonimização de dados pessoais (LGPD)** para alunos inativos ou que
   solicitem exclusão — mencionada no doc 06 mas sem regra operacional definida.
10. **Momento exato de criação do projeto Supabase de homologação** dentro do roadmap (proposto
    "antes do piloto", entre as Fases 6 e 7) — confirmar com o usuário se esse marco deve ser
    antecipado.
11. **Estratégia de multi-tenant futura**: o modelo já reserva `institutions`, mas não há decisão
    sobre como (ou se) isso será ativado para outras igrejas no futuro — mantido fora do escopo
    do MVP, apenas não bloqueado pela estrutura de dados.

---

*Fim da Fase 0 (revisão 2). Aguardando validação do usuário antes de iniciar a Fase 1 (Fundação).*
