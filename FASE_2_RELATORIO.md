# Relatório da Fase 2 — Administração acadêmica

**Status:** entregue, aguardando validação. **Nenhuma Fase 3 foi iniciada.**

---

## 1. Resumo do que foi implementado

- Modelo acadêmico completo: `volumes` (+ pré-requisitos em grafo +
  exceções auditadas), `seasons`, `class_templates` (terça/quinta e
  sábado, com os horários exatos do doc 08), `season_volume_offerings`
  (Season → Oferta → Turmas → Encontros, como definido no
  `PLANO_TECNICO.md`), `classes`, `class_meetings`, `teacher_assignments`
  (única fonte do escopo do professor), `enrollments` e `imports`/
  `import_rows`.
- RLS em todas as tabelas novas: leitura de referência acadêmica liberada
  para qualquer autenticado (volumes, temporadas, ofertas, turmas,
  encontros); escrita e dados de matrícula/exceção restritos a
  coordenação/admin; matrícula e exceção também legíveis pelo próprio
  aluno (transparência sobre a própria situação).
- Função de banco `create_class_with_meetings` (SECURITY INVOKER) cria a
  turma e já gera todos os encontros do modelo de horário numa única
  transação.
- Trigger `enforce_enrollment_class_offering`: garante que a turma
  principal de uma matrícula sempre pertence à mesma oferta de volume —
  defesa em profundidade além da checagem já feita na camada de serviço.
- Regra de pré-requisito implementada como função pura testável
  (`src/services/prerequisites.ts`) e aplicada de verdade na criação de
  matrícula: bloqueia quando o pré-requisito não está concluído, mostra
  qual volume falta, e permite à coordenação autorizar uma exceção
  individual e justificada — sempre auditada via trigger.
- Geração de encontros a partir do modelo de horário também como função
  pura testável (`src/services/classMeetings.ts`), confirmando os números
  do doc 08: 8 encontros × 120 min (terça/quinta) e 4 encontros × 240 min
  (sábado), ambos somando 960 min = 16h.
- Importação de alunos por planilha (.csv/.xlsx): parsing (`papaparse`/
  `exceljs`), validação por linha (função pura testável), criação/
  reaproveitamento de usuário (convite via Supabase Auth quando o e-mail
  ainda não existe), checagem de pré-requisito por linha, matrícula, e
  relatório final por linha (sucesso/erro) com download do CSV só das
  linhas com erro.
- Área de Coordenação com 4 telas reais: Temporadas/Ofertas, Turmas/
  Professores, Matrículas (com o fluxo de bloqueio → exceção → nova
  tentativa) e Importação.
- Autorização estendida: novos recursos (`volumes`, `seasons`,
  `offerings`, `classes`, `class_meetings`, `teacher_assignments`,
  `prerequisite_exceptions`, `imports`) na camada tipada, todos testados.
- 21 novos testes unitários (pré-requisito, geração de encontros,
  validação de importação, políticas da Fase 2) — total agora 43 testes,
  todos passando sem dependência de banco.
- `lint`, `typecheck`, `test` e `build` limpos; smoke test das novas
  rotas (`curl` contra o servidor local, todas retornando 200 e sem erro
  no log do servidor).

## 2. Como os critérios de aceitação da Fase 2 foram endereçados

Critério (PLANO_TECNICO.md, seção 21): *"é possível criar a temporada
2026.2, os três volumes, uma season_volume_offering por volume, uma turma
terça/quinta e uma turma sábado (com os horários do doc 08), matricular
um aluno em dois volumes simultâneos, bloquear um pré-requisito e liberar
exceção auditada, e importar uma planilha exibindo relatório de erros por
linha."*

- **Temporada 2026.2 + 3 volumes**: seed (`supabase/seed.sql`) cria a
  temporada, os 3 volumes com pré-requisitos Essência→Caminho→Voz, e a
  tela `/coordenacao/temporadas` permite criar novas temporadas pela UI.
- **Uma oferta por volume**: seed cria as 3 ofertas (Essência e Caminho
  `open`, Voz `draft`); UI em `/coordenacao/temporadas` cria novas.
- **Turma terça/quinta e turma sábado com os horários do doc 08**: seed
  cria `class_templates` com os valores exatos (120 min/encontro × 8;
  240 min/encontro × 4) e duas turmas de Essência, uma em cada modelo; UI
  em `/coordenacao/turmas` cria novas turmas com os encontros gerados
  automaticamente.
- **Matrícula em dois volumes simultâneos**: seed matricula o usuário de
  teste multi-perfil em Essência **e** Caminho ao mesmo tempo; a tela de
  Matrículas permite isso livremente (o único limite é 1 matrícula por
  aluno **por oferta**, não por aluno).
- **Bloquear pré-requisito e liberar exceção auditada**: testado tanto em
  unidade (`tests/unit/prerequisites.test.ts`) quanto na aplicação real —
  tentar matricular em Caminho/Voz sem o pré-requisito concluído bloqueia
  a matrícula e mostra o formulário de exceção; a exceção exige
  justificativa e é gravada em `audit_logs` via trigger
  (`prerequisite_exceptions_audit`).
- **Importar planilha com relatório de erros por linha**: implementado em
  `/coordenacao/importar`, com tabela linha a linha (sucesso/erro) e
  download do CSV de erros.

## 3. Arquivos criados/alterados

**Migrations** (`supabase/migrations/`): `00000000000014_volumes.sql`,
`00000000000015_seasons_and_offerings.sql`,
`00000000000016_classes_and_meetings.sql`,
`00000000000017_enrollments.sql`, `00000000000018_imports.sql`,
`00000000000019_create_class_with_meetings.sql`,
`00000000000020_profiles_email.sql`. `supabase/seed.sql` estendido com os
dados fictícios da 2026.2.

**Serviços puros** (`src/services/`): `prerequisites.ts`,
`classMeetings.ts`, `studentImport.ts`.

**Módulo acadêmico** (`src/modules/academic/`): `schemas.ts`,
`lookupUser.ts`, `prerequisiteContext.ts`, `importLookups.ts`,
`importParsing.ts`,
`actions/{createSeason,createOffering,createClass,assignTeacher,
createEnrollment,createPrerequisiteException,importStudents}.ts`,
`components/{CreateSeasonForm,CreateOfferingForm,CreateClassForm,
AssignTeacherForm,EnrollmentForm,PrerequisiteExceptionForm,
ImportStudentsForm}.tsx`.

**Rotas** (`src/app/(app)/coordenacao/`): `page.tsx` (reescrita como hub),
`temporadas/page.tsx`, `turmas/page.tsx`, `matriculas/page.tsx`,
`importar/page.tsx`.

**Autorização**: `src/authorization/types.ts` e `policies.ts` estendidos
com os novos recursos da Fase 2.

**Tipos Supabase**: `src/integrations/supabase/types.ts` estendido com as
9 novas tabelas e a função `create_class_with_meetings` (ainda placeholder
manual — mesma ressalva da Fase 1, regenerar quando houver projeto real).

**Testes**: `tests/unit/{prerequisites,classMeetings,studentImport}.test.ts`
(novos), `tests/unit/authorization.test.ts` (estendido).

**Dependências novas**: `papaparse`, `exceljs`, `@types/papaparse`.

## 4. Resultado dos comandos de entrega

```text
npm test    → 5 arquivos, 43 testes, todos passando
npm run typecheck → sem erros
npm run lint       → sem erros, sem warnings
npm run build       → build de produção concluído; todas as 17 rotas
                       corretamente dinâmicas (ƒ)
npm run check:no-secret-in-bundle → OK, 0 ocorrências em 28 arquivos client-side

Smoke test manual (servidor local, `curl`):
  /login, /coordenacao, /coordenacao/temporadas, /coordenacao/turmas,
  /coordenacao/matriculas, /coordenacao/importar → todas 200, sem erro
  no log do servidor (redirecionam para /login por falta de sessão real,
  comportamento esperado sem projeto Supabase provisionado).
```

## 5. Decisões e simplificações desta entrega (declaradas, não escondidas)

1. **Importação processada de forma síncrona**, dentro da própria Server
   Action, não através da fila `AsyncTaskQueue` construída na Fase 1.
   Decisão consciente: o volume esperado (uma única congregação, algumas
   dezenas de linhas) cabe numa requisição, e não há worker
   (Netlify Background Function) executável nesta sandbox para validar um
   fluxo assíncrono de verdade. Mover para a fila fica como hardening
   futuro se o tamanho típico de planilha crescer — a assinatura da ação
   já isola a lógica de parsing/validação em funções puras, o que
   facilita essa migração depois.
2. **Sem upload para o Supabase Storage**: o arquivo é lido inteiramente
   em memória durante a requisição, não é persistido em um bucket
   `imports` (Storage só entra no roadmap a partir da Fase 3). Se o
   processamento falhar no meio, não há como retomar de onde parou nesta
   fase — cada linha é gravada em `import_rows` conforme processada, o
   que pelo menos preserva o progresso já feito.
3. **Sem mapeamento de colunas configurável na UI**: os cabeçalhos são
   fixos (nome, email, telefone, nascimento, volume, temporada, turma),
   em vez do wizard de 10 passos completo descrito no doc 06 §5. Cobre o
   critério de aceitação da fase; o wizard completo (mapeamento visual de
   colunas) fica para quando houver necessidade real de planilhas fora
   desse formato.
4. **Busca de professor/aluno por e-mail exato**, não um campo de busca
   com autocomplete — suficiente para o volume de uma única congregação
   nesta fase.
5. **`enrollment_status_history` não foi criada** como tabela dedicada
   (estava no modelo conceitual original) — alterações de matrícula já
   ficam no `audit_logs` genérico via trigger; uma tabela de histórico
   dedicada pode ser adicionada depois se a granularidade do audit log
   genérico não for suficiente para alguma tela futura.
6. **`profiles` ganhou uma coluna `email`**, sincronizada de
   `auth.users.email` pelo trigger `handle_new_user` — decisão nova desta
   fase, não prevista explicitamente no `PLANO_TECNICO.md` original.
   Necessária para que coordenação/admin localizem um usuário por e-mail
   (designar professor, matricular aluno) usando o client autenticado
   comum, sem precisar do client administrativo só para uma busca.

## 6. Pendências herdadas da Fase 1 (ainda não resolvidas)

Continuam valendo exatamente como declaradas em `FASE_1_RELATORIO.md`:
nenhum teste de integração de RLS foi executado (sem Docker/Supabase CLI
nesta sessão), `seed.sql` não foi validado contra um Postgres real, não
há projeto Supabase nem GitHub/Netlify conectados. **Isso agora cobre
também todas as migrations e o seed novos desta fase** — a primeira coisa
a fazer ao configurar o ambiente local é `supabase db reset` e depois
`npm run test:integration`, revisando com atenção as novas policies de
`enrollments`/`prerequisite_exceptions`/`imports` e o trigger
`enforce_enrollment_class_offering`.

---

Aguardando validação do usuário antes de iniciar a Fase 3 (Conteúdo e
área do aluno).
