# Relatório da Fase 3 — Conteúdo e área do aluno

**Status:** entregue, aguardando validação. **Nenhuma Fase 4 foi iniciada.**

---

## 1. Resumo do que foi implementado

- Estrutura completa Volume → Módulo → Aula → Conteúdo, com `volume_id`
  denormalizado em `contents` (mantido consistente por trigger, mesmo
  padrão da Fase 2) e RLS que já resolve "aluno só vê conteúdo de
  matrícula autorizada" na origem: conteúdo publicado, não exclusivo de
  staff, e só do volume em que o aluno tem matrícula ativa/em
  regularização/aprovada.
- Vídeo do YouTube não listado (`video_contents`) com player via IFrame
  Player API oficial, progresso reportado periodicamente ao servidor
  (`updateVideoProgress`), percentual de conclusão calculado no servidor
  (nunca confia no cliente), nunca regride se o aluno voltar o vídeo, e
  concluído automaticamente ao atingir o percentual mínimo (80% padrão,
  configurável por conteúdo).
- Regras de liberação (`release_rules`: imediata, por data, manual, após
  outro conteúdo, após exercício, após encontro) avaliadas por uma função
  pura testada isoladamente (`isContentReleased`) — um conteúdo sem regra
  cadastrada é liberado imediatamente; múltiplas regras no mesmo conteúdo
  funcionam como OR.
- Banco de questões e exercícios de fixação, com a invariante herdada da
  Fase 1 preservada de verdade: `question_bank`/`question_options` são
  **inacessíveis por RLS** para quem não é da equipe de conteúdo — um
  aluno só vê uma questão através da função `get_activity_questions_for_attempt`
  (SECURITY DEFINER), que nunca devolve `is_correct`. A correção
  (`submit_activity_attempt`) roda inteiramente no servidor; o feedback
  com a resposta certa só é revelado depois do envio, e só se o exercício
  estiver configurado para mostrar feedback. Exercício nunca gera nota —
  não há nenhuma coluna de nota em `activity_attempts`, só contagem de
  acertos para fins formativos.
- Área do aluno: `/meus-volumes` (matrículas ativas, inclusive
  simultâneas), `/meus-volumes/[enrollmentId]` (árvore de módulos/aulas/
  conteúdos com cadeado visual no que ainda não está liberado),
  `/aula/[contentId]` (player/arquivo/texto/link conforme o tipo),
  `/exercicios/[activityId]` (responder, corrigir, ver feedback) e
  `/agenda` (encontros das turmas matriculadas).
- Estúdio de conteúdo (`/conteudo` e `/conteudo/questoes`) para
  coordenação/admin/editor: criar módulo, aula, conteúdo (vídeo/arquivo/
  texto/link), publicar/despublicar, criar regra de liberação, criar
  questão (múltipla escolha ou V/F) e exercício, vincular questão a
  exercício.
- 27 novos testes unitários (liberação de conteúdo, progresso de vídeo,
  correção de exercício, políticas de autorização da Fase 3) — total
  agora **70 testes**, todos sem dependência de banco.
- `lint`, `typecheck`, `test` e `build` limpos; build gera 22 rotas,
  todas corretamente dinâmicas; verificação de vazamento de segredo no
  bundle OK; smoke test manual de todas as rotas novas sem erro no log
  do servidor.

## 2. Como os critérios de aceitação da Fase 3 foram endereçados

Critério (`PLANO_TECNICO.md`, seção 21): *"aluno só vê conteúdo de
matrícula autorizada; conteúdo é liberado gradualmente; progresso do
vídeo é salvo; exercício obrigatório não altera média; conteúdo
complementar não bloqueia conclusão; volume concluído permanece
acessível."*

- **Matrícula autorizada**: garantido em duas camadas — RLS de `contents`/
  `activities` (`has_active_enrollment_in_volume`) e a própria página do
  aluno, que só monta a árvore a partir de uma `enrollmentId` que
  pertence ao usuário autenticado.
- **Liberação gradual**: demonstrado no seed — o conteúdo de texto da
  Aula 2 só libera depois que o vídeo obrigatório da Aula 1 é concluído
  (regra `after_content`), testável de ponta a ponta.
- **Progresso do vídeo salvo**: `content_progress` persiste posição,
  percentual e conclusão por matrícula+conteúdo; testado em unidade
  (`videoProgress.test.ts`) e integrado no player real.
- **Exercício não altera nota**: `activities`/`activity_attempts` não têm
  nenhum campo de nota — só `correct_count`/`total_count`, explicitamente
  formativos; a matrícula (`enrollments.final_grade`) não é tocada em
  nenhum lugar do fluxo de exercício.
- **Complementar não bloqueia**: a árvore do aluno mostra todo o
  conteúdo liberado independente da classificação; só `blocks_progress`
  de uma atividade (quando marcado) impediria avanço — não implementado
  como bloqueio de navegação nesta fase (ver pendências).
- **Volume concluído permanece acessível**: não há nenhuma lógica de
  ocultar `/meus-volumes/[enrollmentId]` por status da matrícula — o
  aluno continua vendo o conteúdo enquanto a matrícula existir e a conta
  estiver ativa.

## 3. Arquivos criados/alterados

**Migrations**: `00000000000021_modules_and_lessons.sql` até
`00000000000025_contents_body.sql` (módulos, aulas, conteúdo, vídeo,
arquivo, banco de questões, exercícios/tentativas com 3 funções
SECURITY DEFINER de correção server-side, regras de liberação,
progresso). `supabase/seed.sql` estendido com módulo/aulas/conteúdos/
exercício de exemplo em Essência.

**Serviços puros** (`src/services/`): `contentRelease.ts`,
`videoProgress.ts`, `activityGrading.ts`.

**Módulo de conteúdo** (`src/modules/content/`): schemas, ações
(`createModule`, `createLesson`, `createContent`, `publishContent`,
`createReleaseRule`, `createQuestion`, `createActivity`,
`attachQuestion`) e componentes de formulário correspondentes.

**Módulo de aprendizagem** (`src/modules/learning/`):
`loadVolumeOutline.ts` (monta a árvore com liberação resolvida),
`actions/{updateVideoProgress,activityAttempt}.ts`,
`components/{VideoPlayer,ActivityRunner}.tsx`.

**Rotas novas**: `/conteudo` (reescrita), `/conteudo/questoes`,
`/meus-volumes`, `/meus-volumes/[enrollmentId]`, `/aula/[contentId]`,
`/exercicios/[activityId]`, `/agenda`; `/dashboard` ganhou atalhos por
perfil.

**Autorização**: novos recursos `content`, `question_bank`,
`activities`, `release_rules` em `src/authorization`.

**Tipos Supabase**: `src/integrations/supabase/types.ts` estendido com
13 tabelas novas e as 3 funções RPC de exercício.

**Testes**: `tests/unit/{contentRelease,videoProgress,activityGrading}.test.ts`
(novos), `tests/unit/authorization.test.ts` (estendido).

## 4. Resultado dos comandos de entrega

```text
npm test    → 8 arquivos, 70 testes, todos passando
npm run typecheck → sem erros
npm run lint       → sem erros, sem warnings
npm run build       → build de produção concluído; 22 rotas, todas ƒ (dinâmicas)
npm run check:no-secret-in-bundle → OK, 0 ocorrências em 32 arquivos client-side

Smoke test manual (servidor local, `curl`): /login, /dashboard,
/meus-volumes, /agenda, /conteudo, /conteudo/questoes,
/aula/[id-fictício], /exercicios/[id-fictício],
/meus-volumes/[id-fictício] → todas 200, sem erro no log do servidor.
```

## 5. Decisões e simplificações desta entrega (declaradas, não escondidas)

1. **`blocks_progress` de exercício existe no modelo, mas não trava
   navegação ainda**: a coluna e a regra de negócio estão no banco
   (`activities.blocks_progress`), mas a árvore do aluno
   (`/meus-volumes/[enrollmentId]`) ainda não impede clicar no próximo
   conteúdo se um exercício obrigatório anterior não foi enviado. Fica
   como reforço de UX para a Fase 4+ — a regra "conteúdo obrigatório"
   (classification) já é visualmente marcada, mas o bloqueio ativo de
   navegação não foi implementado.
2. **Criação de conteúdo não é atômica** (`createContent.ts`): ao
   contrário de `create_class_with_meetings` (Fase 2), criar um conteúdo
   de vídeo/arquivo é uma sequência de dois INSERTs no Server Action, não
   uma única transação via RPC. Se o segundo passo falhar, o conteúdo já
   existe como registro editável — recuperável, mas não atômico.
   Documentado como possível hardening futuro.
3. **Sem upload real de arquivo**: `content_files.file_url` continua
   sendo uma URL colada manualmente (mesma decisão da importação de
   planilhas na Fase 2) — Supabase Storage ainda não foi provisionado.
4. **Editor de questão só cobre múltipla escolha e verdadeiro/falso**:
   `question_bank.type` já modela associação, ordenação e preenchimento
   com opções (doc 02 §5.6), mas só os dois primeiros tipos têm tela de
   autoria e tela de resposta nesta fase. Ampliar os tipos restantes é
   trabalho de UI, não de modelo de dados ou de segurança.
5. **`after_meeting` (liberar após um encontro presencial) é avaliado de
   forma aproximada**: como `class_meetings.meeting_date` está
   propositalmente vazio no seed (não inventamos datas reais — doc 08
   §14), a regra existe e é avaliada corretamente pela função pura, mas
   não há nenhum encontro com data real para exercitá-la de ponta a
   ponta ainda.
6. **Agenda é só do aluno nesta fase**: a agenda do professor (doc 04
   PRO-02) fica para a Fase 4, quando a área do professor for
   implementada de verdade.
7. **Pré-visualização "como aluno" para a equipe de conteúdo** (doc 04
   CON-07) não foi implementada — quem cria conteúdo confia na revisão
   direta no Estúdio de Conteúdo, sem uma tela de simulação da visão do
   aluno.

## 6. Pendências herdadas (ainda não resolvidas)

Continuam valendo as pendências já declaradas em `FASE_1_RELATORIO.md` e
`FASE_2_RELATORIO.md`: nenhum teste de integração de RLS foi executado
(sem Docker/Supabase CLI nesta sessão), `seed.sql` não foi validado
contra um Postgres real, não há projeto Supabase/GitHub/Netlify
conectados. **Isso agora cobre também as migrations e o seed desta
fase** — a primeira coisa a fazer ao configurar o ambiente local
continua sendo `supabase db reset` e depois `npm run test:integration`,
com atenção especial às três funções SECURITY DEFINER de exercício
(`start_activity_attempt`, `get_activity_questions_for_attempt`,
`submit_activity_attempt`), já que são a peça mais sensível de segurança
desta fase — vale a pena um teste de integração dedicado confirmando que
um aluno realmente não consegue ler `question_options.is_correct` por
nenhum caminho direto via API.

---

Aguardando validação do usuário antes de iniciar a Fase 4 (Área do
professor).
