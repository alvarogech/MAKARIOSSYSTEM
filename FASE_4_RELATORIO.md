# Relatório da Fase 4 — Área do professor

**Status:** entregue, aguardando validação. **Nenhuma Fase 5 foi iniciada.**

---

## 1. Resumo do que foi implementado

- `attendance_records`: registro de frequência com os 7 estados exatos do
  doc 02 §9.7 (presente, ausente, atrasado, presença parcial, falta
  justificada, reposição, pendente), minutos reconhecidos (nunca
  contagem de encontros), e um campo `finalized_at` que implementa a
  distinção "registrar vs. corrigir" da matriz de permissões
  (`PLANO_TECNICO.md` seção 3): **o professor registra e ainda pode
  ajustar enquanto o encontro está em rascunho; depois de finalizado, só
  coordenação/administração corrigem** — reforçado por RLS (a policy de
  UPDATE do professor exige `finalized_at IS NULL` nos dois lados da
  checagem, então ele nem consegue se autofinalizar por UPDATE direto).
- `attendance_change_history`: preenchido automaticamente por trigger
  (só em alterações de status/minutos, nunca no registro inicial),
  capturando valor anterior, novo, responsável e justificativa — a
  justificativa é propagada corretamente para dentro da mesma transação
  via a função `save_attendance_row` (reaproveitando o mecanismo de
  sessão `app.justification` já criado na Fase 1).
- `class_meeting_reports` (relatório pós-aula, doc 04 PRO-07): o
  professor envia por encontro; "chega à coordenação" é resolvido
  diretamente por RLS (coordenação/admin leem tudo) e por uma tela
  dedicada (`/coordenacao/relatorios`) que consulta esses relatórios sem
  depender de nenhuma notificação.
- Cálculo de frequência como função pura testada isoladamente
  (`resolveRecognizedMinutes`, `calculateAttendancePercent`,
  `isAttendanceSufficient`) — já confirma o critério "12 de 16 horas
  resulta em 75%" que será reusado como critério de aceitação formal na
  Fase 6.
- Área do professor: `/professor` (dashboard com contagem de turmas),
  `/professor/turmas` (via `teacher_assignments` — única fonte do escopo
  do professor), `/professor/turmas/[classId]` (alunos, encontros,
  materiais/preparação de aula reaproveitando os `contents` publicados
  do volume, criados na Fase 3), tela de frequência com "marcar todos
  presentes" + ajuste individual + finalizar, formulário de relatório
  pós-aula, e agenda do professor.
- 14 novos testes unitários (cálculo de frequência) + 8 novos testes de
  autorização (registrar vs. corrigir frequência; enviar vs. ler
  relatório) — total agora **88 testes**, todos sem dependência de banco.
- `lint`, `typecheck`, `test` e `build` limpos; build gera 28 rotas,
  todas corretamente dinâmicas; verificação de vazamento de segredo no
  bundle OK; smoke test manual de todas as rotas novas sem erro no log
  do servidor.

## 2. Como os critérios de aceitação da Fase 4 foram endereçados

Critério (`PLANO_TECNICO.md`, seção 21): *"professor vê apenas suas
turmas; registra presença; registra presença parcial; não edita
conteúdo; não vê dados financeiros; relatório chega à coordenação."*

- **Só suas turmas**: `teacher_assignments` continua sendo a única fonte
  de escopo (nunca `user_roles`) — `/professor/turmas` só lista turmas
  com vínculo, e todas as rotas de detalhe/frequência/relatório fazem
  uma checagem explícita de vínculo além da RLS (`is_teacher_assigned_to_class`).
- **Registra presença e presença parcial**: implementado na tela de
  frequência, com minutos reconhecidos calculados por
  `resolveRecognizedMinutes` (função pura testada) e persistidos via
  `save_attendance_row`.
- **Não edita conteúdo**: nenhuma mudança nas policies de `contents`/
  `question_bank` da Fase 3 — o professor continua sem policy de escrita
  nelas; a tela de "materiais" desta fase é somente leitura, reaproveitando
  a RLS `contents_select_teacher` já existente.
- **Não vê dado financeiro**: não existe nenhum dado financeiro em
  nenhuma tabela do sistema até esta fase — critério trivialmente
  satisfeito, mas vale registrar para quando dados sensíveis administrativos
  existirem de fato.
- **Relatório chega à coordenação**: RLS + tela dedicada de leitura para
  coordenação/admin (`/coordenacao/relatorios`), verificada manualmente.

## 3. Arquivos criados/alterados

**Migrations**: `00000000000026_attendance.sql` (tabela, histórico com
trigger, trigger de consistência matrícula↔turma, `is_teacher_assigned_to_class`,
`finalize_attendance`, RLS completa), `00000000000027_class_meeting_reports.sql`,
`00000000000028_save_attendance_row.sql` (upsert com justificativa na
mesma transação). `supabase/seed.sql` estendido com frequência de
exemplo (uma presença integral, uma parcial).

**Serviços puros**: `src/services/attendance.ts`.

**Módulo de ensino** (`src/modules/teaching/`): schemas, ações
(`saveAttendance`, `finalizeAttendance`, `submitClassReport`),
componentes (`AttendanceForm`, `ClassReportForm`).

**Rotas novas**: `/professor` (reescrita), `/professor/turmas`,
`/professor/turmas/[classId]`, `/professor/turmas/[classId]/encontros/
[meetingId]/frequencia`, `.../relatorio`, `/professor/agenda`,
`/coordenacao/relatorios`; `/coordenacao` ganhou o link correspondente.

**Autorização**: novos recursos `attendance` (record/correct) e
`class_reports` (submit/read) em `src/authorization`.

**Tipos Supabase**: `src/integrations/supabase/types.ts` estendido com 3
tabelas novas e 2 funções RPC (`finalize_attendance`, `save_attendance_row`).

**Testes**: `tests/unit/attendance.test.ts` (novo),
`tests/unit/authorization.test.ts` (estendido).

## 4. Resultado dos comandos de entrega

```text
npm test    → 9 arquivos, 88 testes, todos passando
npm run typecheck → sem erros
npm run lint       → sem erros, sem warnings
npm run build       → build de produção concluído; 28 rotas, todas ƒ (dinâmicas)
npm run check:no-secret-in-bundle → OK, 0 ocorrências em 34 arquivos client-side

Smoke test manual (servidor local, `curl`): /professor, /professor/turmas,
/professor/agenda, /professor/turmas/[id-fictício] (+ frequência e
relatório), /coordenacao/relatorios → todas 200, sem erro no log do
servidor.
```

## 5. Decisões e simplificações desta entrega (declaradas, não escondidas)

1. **"Rascunho/finalizar" é por encontro inteiro, não por aluno**: uma
   vez finalizado, todos os registros daquele encontro ficam bloqueados
   para o professor de uma vez (via `finalize_attendance`), não há
   finalização parcial linha a linha. Simplificação razoável frente ao
   fluxo real (o professor finaliza a chamada da aula inteira).
2. **`attendance_change_history` é uma tabela dedicada, não reaproveita
   o `audit_logs` genérico da Fase 1**: decisão deliberada — o doc 05
   pede uma estrutura própria para "valor anterior/novo" de frequência, e
   duplicar no `audit_logs` genérico só adicionaria ruído. Isso significa
   que uma consulta de auditoria completa (Fase 8) vai precisar olhar as
   duas tabelas para o quadro inteiro de alterações sensíveis.
3. **Reposição não é implementada nesta fase**: o estado `reposicao`
   existe no enum e é tratado como 0 minutos reconhecidos por padrão
   (igual a uma falta), exatamente como deveria ser **antes** de uma
   reposição ser validada — o crédito separado (`attendance_makeup_credits`)
   e todo o fluxo de solicitação/aprovação são explicitamente Fase 6.
4. **`calculateAttendancePercent` ainda não é chamado em nenhuma tela**:
   a função existe e está testada, mas o cálculo real de frequência por
   matrícula (parte do critério de aceitação da Fase 6) só será exibido
   quando "minha situação" (aluno) e os relatórios de frequência
   (coordenação) forem construídos.
5. **Preparação de aula continua reaproveitando `contents`** (decisão já
   declarada na Fase 3) em vez de um modelo de "plano de aula" próprio
   com os campos ricos do doc04 PRO-05 (ementa, dinâmicas, aplicações
   como campos estruturados) — o professor vê os materiais publicados do
   volume, não uma tela de plano de aula dedicada.
6. **Biblioteca do professor (PRO-08) não é uma tela separada**: está
   embutida na página de detalhe da turma ("Materiais e preparação de
   aula"), não uma seção própria com filtro por tipo de material.

## 6. Pendências herdadas (ainda não resolvidas)

Continuam valendo as pendências já declaradas nos relatórios das Fases
1 a 3: nenhum teste de integração de RLS foi executado (sem Docker/
Supabase CLI nesta sessão), `seed.sql` não foi validado contra um
Postgres real, não há projeto Supabase/GitHub/Netlify conectados. A
peça mais sensível desta fase para validar assim que houver ambiente
real é a combinação de policies de `attendance_records` — especialmente
confirmar que um professor genuinamente **não consegue** fazer UPDATE
numa linha já finalizada mesmo tentando via API direta (RLS deveria
rejeitar), e que `save_attendance_row` propaga a justificativa
corretamente para o histórico numa correção feita por coordenação.

---

Aguardando validação do usuário antes de iniciar a Fase 5 (Avaliações e
recuperação).
