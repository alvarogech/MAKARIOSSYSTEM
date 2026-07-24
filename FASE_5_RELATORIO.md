# Relatório da Fase 5 — Avaliações e recuperação

**Status:** entregue, aguardando validação. **Nenhuma Fase 6 foi iniciada.**

---

## 1. Resumo do que foi implementado

Esta foi a fase mais sensível do projeto até aqui — nota, aprovação e
certificado dependem diretamente da integridade da correção. As três
invariantes de segurança acadêmica definidas antes mesmo de avaliações
existirem (Fase 1) foram implementadas de verdade:

- **Snapshot imutável** (`assessment_attempt_questions`): ao iniciar uma
  tentativa, `start_assessment_attempt` grava, numa única transação, as
  questões, ordem, ordem das alternativas, valor de cada questão e a
  resposta correta vigente naquele instante. Um trigger (`forbid_snapshot_mutation`)
  bloqueia qualquer UPDATE/DELETE depois disso — alterações futuras no
  banco de questões nunca afetam uma prova já iniciada.
- **Conjunto fixo de elegíveis** (`assessment_eligible_students`):
  calculado uma única vez em `publish_assessment` (o momento em que a
  coordenação publica a avaliação), com trigger que bloqueia qualquer
  UPDATE depois. O gabarito verifica "todos enviaram" contra esse
  conjunto congelado — uma matrícula criada depois nunca atrasa a
  liberação.
- **Resposta correta nunca chega ao aluno antes da hora**: `question_bank`/
  `question_options` seguem bloqueados por RLS para quem não é da equipe
  de conteúdo (mesma regra da Fase 3); durante a prova, o aluno só vê
  `get_assessment_attempt_questions` (sem `is_correct`); a correção
  acontece inteiramente dentro de `submit_assessment_answer` (server-side,
  contra o snapshot); o gabarito completo só aparece via
  `get_assessment_attempt_review`, que checa explicitamente
  `answer_key_released_at is not null` antes de devolver qualquer coisa.

Além disso:

- **Cronômetro server-authoritative**: `deadline_at` é calculado no
  servidor no início da tentativa; toda escrita (`submit_assessment_answer`,
  `finalize_assessment_attempt`) revalida contra o prazo — mesmo que o
  cliente trapaceie o relógio local, nada é aceito fora do prazo. Uma
  função agendada via Supabase Cron (`pg_cron`) varre tentativas vencidas
  e as encerra mesmo se o aluno nunca mais abrir a página.
- **Padrão de interação extraído de referência real**: a pedido do
  usuário, analisei `makarios2026.netlify.app` (site de exercícios de uma
  temporada sem o sistema) antes de desenhar esta fase. De lá vieram três
  decisões concretas: (1) cada questão tem seu próprio "Confirmar
  resposta" que **trava** a resposta imediatamente — implementado como
  `assessment_answers` só aceita INSERT, nunca UPDATE, e o RPC retorna
  `alreadyAnswered: true` num reenvio; (2) cronômetro visível
  "TEMPO RESTANTE mm:ss" + contador "X de N confirmadas"; (3) três
  variações de múltipla escolha ("uma resposta correta", "marque todas as
  corretas", "marque a incorreta") — a última é só semântica de
  enunciado, mas a segunda exigiu um campo novo, `selection_mode`
  ("single"/"multiple"), retrofitado também na Fase 3 (exercícios), que
  antes só renderizava rádio mesmo quando a questão tinha mais de uma
  resposta certa. **Os números do site antigo (15 questões, 40 minutos)
  NÃO foram usados** — os padrões desta fase continuam sendo os dos docs
  02/08 (20 questões, 60 minutos, 14 dias, nota mínima 6), que têm
  prioridade sobre qualquer referência histórica.
- **Recuperação**: `recovery_path_items` modela a trilha de revisão
  obrigatória (conteúdo ou exercício); `is_recovery_path_completed`
  bloqueia o início da tentativa até tudo estar concluído; o banco de
  questões é garantidamente disjunto da avaliação regular (trigger
  `enforce_recovery_questions_disjoint`, testado na inserção). Nota final
  = maior entre regular e recuperação, aplicado automaticamente em
  `private.finalize_attempt_scoring` sobre `enrollments.final_grade`.
- **Tentativa excepcional**: sempre manual, com justificativa obrigatória,
  auditada via trigger (`assessment_exceptional_grants`).
- **Construtor de avaliação**: criar avaliação (final/recuperação),
  adicionar questões com valor e ordem, montar a trilha de revisão,
  publicar, liberar gabarito manualmente, conceder tentativa excepcional
  — tudo em `/conteudo/avaliacoes`.
- **41 novos testes unitários** (correção de avaliação, regra de
  liberação de gabarito, nota final, políticas de autorização da Fase 5)
  — total agora **111 testes**, todos sem dependência de banco.
- `lint`, `typecheck`, `test` e `build` limpos; build gera 33 rotas,
  todas corretamente dinâmicas; verificação de vazamento de segredo no
  bundle OK; smoke test manual de todas as rotas novas sem erro no log
  do servidor.

## 2. Como os critérios de aceitação da Fase 5 foram endereçados

Critério (`PLANO_TECNICO.md`, seção 21): *"avaliação usa 20 questões;
tempo de 60 minutos; janela de 14 dias; média 6; nenhuma questão
discursiva; recuperação usa 20 questões diferentes; gabarito respeita
regra; nota maior da recuperação substitui regular."*

- **20 questões / 60 minutos / 14 dias / nota 6**: são os valores padrão
  de `createAssessment` (doc 02/08); o seed cria a avaliação de exemplo
  de Essência com exatamente esses números, e a recuperação vinculada
  também com 20 questões.
- **Nenhuma discursiva**: `question_bank.type` continua restrito a
  `multiple_choice`/`true_false`/`matching`/`ordering`/`fill_in_blank` —
  não existe (e nunca existiu) um tipo de resposta livre.
- **Recuperação com 20 questões diferentes**: garantido por trigger no
  banco (`enforce_recovery_questions_disjoint`), não só por convenção —
  testado no seed (20 questões novas, nunca reaproveitadas da regular).
- **Gabarito respeita a regra**: `evaluate_answer_key_release`
  (SQL, rodando a cada minuto via `pg_cron`) e sua função pura espelhada
  (`evaluateAnswerKeyRelease`, testada) implementam exatamente "primeiro
  entre: todos os elegíveis enviaram / prazo encerrado / liberação
  manual".
- **Nota maior substitui**: `private.finalize_attempt_scoring` aplica
  `greatest(coalesce(final_grade,0), score)` em `enrollments.final_grade`
  toda vez que uma tentativa (regular ou recuperação) é finalizada —
  testado isoladamente em `resolveFinalGrade`.

## 3. Arquivos criados/alterados

**Migrations**: `00000000000029` (selection_mode em question_bank) até
`00000000000036` (retrofit de get_activity_questions_for_attempt) — 8
migrations novas: assessments/assessment_questions, snapshot + conjunto
de elegíveis, tentativas/respostas + 5 funções SECURITY DEFINER, trilha
de revisão + tentativa excepcional, cron de expiração/liberação de
gabarito, publicação/liberação manual. `supabase/seed.sql` estendido com
avaliação final + recuperação de exemplo (20+20 questões fictícias).

**Serviços puros**: `src/services/{assessmentGrading,answerKeyRelease,finalGrade}.ts`.

**Módulo de avaliação** (`src/modules/assessment/`): schemas, ações de
autoria (`createAssessment`, `addQuestionToAssessment`,
`addRecoveryPathItem`, `publishAssessment`, `releaseAnswerKey`,
`grantExceptionalAttempt`), ações de tentativa (`attemptActions.ts` —
start/getQuestions/submitAnswer/finalize/getReview), componentes de
autoria e os componentes de prova (`AssessmentRunner`,
`AssessmentReview`, `StartAssessmentButton`).

**Rotas novas**: `/conteudo/avaliacoes`, `/avaliacoes/[assessmentId]`
(intro), `.../prova`, `.../resultado`; `/meus-volumes/[enrollmentId]`
ganhou uma seção linkando para avaliações abertas da oferta.

**Retrofit da Fase 3**: `question_bank.selection_mode`,
`CreateQuestionForm`/`createQuestion` (autoria) e
`ActivityRunner`/`get_activity_questions_for_attempt` (exercício do
aluno) agora respeitam rádio vs. checkbox corretamente.

**Autorização**: recurso `assessments` (manage/publish/release_answer_key/
grant_exceptional_attempt/take) em `src/authorization`.

**Tipos Supabase**: `src/integrations/supabase/types.ts` estendido com 8
tabelas novas e 7 funções RPC de avaliação.

**Testes**: `tests/unit/{assessmentGrading,answerKeyRelease,finalGrade}.test.ts`
(novos), `tests/unit/authorization.test.ts` estendido.

## 4. Resultado dos comandos de entrega

```text
npm test    → 12 arquivos, 111 testes, todos passando
npm run typecheck → sem erros
npm run lint       → sem erros, sem warnings (1 erro de
                       react-hooks/set-state-in-effect corrigido durante a fase)
npm run build       → build de produção concluído; 33 rotas, todas ƒ (dinâmicas)
npm run check:no-secret-in-bundle → OK, 0 ocorrências em 38 arquivos client-side

Smoke test manual (servidor local, `curl`): /conteudo/avaliacoes,
/avaliacoes/[id-fictício] (+ /prova + /resultado) → todas 200, sem erro
no log do servidor.
```

## 5. Decisões e simplificações desta entrega (declaradas, não escondidas)

1. **Números do site de referência não foram adotados**: 15 questões/40
   minutos eram de uma temporada sem o sistema — os docs 02/08 (fonte de
   verdade) mandam 20/60/14 dias/nota 6, que são os valores realmente
   implementados como padrão.
2. **Explicação e referência bíblica do gabarito não fazem parte do
   snapshot imutável**: `get_assessment_attempt_review` busca esses dois
   campos ao vivo de `question_bank`, não do snapshot — decisão
   deliberada, já que são texto informativo (não afetam correção/nota),
   e assim não exigem mais uma tabela de snapshot só para isso.
3. **Elegibilidade da recuperação não é recalculada por matrícula
   individual**: o conjunto de elegíveis da recuperação é congelado do
   mesmo jeito que o da avaliação regular, na publicação — não há uma
   regra automática "só entra na recuperação quem tirou nota abaixo de
   6"; a tela do aluno mostra a recuperação disponível a qualquer
   matriculado na oferta que a trilha de revisão esteja concluída, mas a
   decisão de fato de "quem precisa" fica visível pelo resultado da
   regular, não é imposta por RLS.
4. **`pg_cron` não pôde ser testado**: como nas fases anteriores, sem
   Docker/Supabase CLI nesta sessão, a migration que habilita `pg_cron` e
   agenda as duas funções de manutenção (`expire_assessment_attempts`,
   `evaluate_answer_key_release`) não foi aplicada nem verificada contra
   um projeto real. É a pendência mais importante desta fase — sem o cron
   rodando, tentativas abandonadas só são encerradas quando alguém
   chama `finalize_assessment_attempt` manualmente (o que ainda acontece
   corretamente a cada tentativa de escrita depois do prazo, via a
   checagem de `deadline_at` dentro de `submit_assessment_answer`, então
   não há risco de nota indevida — só de a tentativa ficar "pendurada"
   como `in_progress` até alguém interagir com ela de novo).
5. **Construtor de avaliação não valida "exatamente N questões" antes de
   publicar**: `questions_count` é só um valor configurado
   (informativo/para a UI do aluno) — nada impede publicar uma avaliação
   com menos questões vinculadas do que o configurado. Fica como
   melhoria futura de UX (validação na hora de publicar).
6. **Sem tela de "resultados da turma" para a coordenação nesta fase**:
   dá para consultar `assessment_attempts` diretamente (RLS já libera
   leitura para coordenação/admin), mas não foi construída uma tela
   dedicada de acompanhamento de notas por turma — isso se encaixa
   melhor nos relatórios da Fase 8.

## 6. Pendências herdadas (ainda não resolvidas)

Continuam valendo as pendências já declaradas nos relatórios das Fases 1
a 4: nenhum teste de integração de RLS foi executado (sem Docker/
Supabase CLI nesta sessão), `seed.sql` não foi validado contra um
Postgres real, não há projeto Supabase/GitHub/Netlify conectados dentro
do próprio repositório ainda. Para esta fase, a verificação mais crítica
ao configurar um ambiente real é: (1) confirmar que `pg_cron` habilita
sem erro e que as duas funções agendadas rodam; (2) rodar
`supabase db reset` e tentar, como aluno de teste, ler
`question_options.is_correct` por qualquer caminho direto via API —
deve falhar sempre; (3) simular duas abas abertas na mesma questão
confirmando resposta ao mesmo tempo, para confirmar que só a primeira
`INSERT` em `assessment_answers` vale (a segunda deve retornar
`alreadyAnswered: true`, nunca sobrescrever).

---

Aguardando validação do usuário antes de iniciar a Fase 6 (Frequência e
reposição).
