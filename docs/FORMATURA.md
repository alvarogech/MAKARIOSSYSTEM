# Central de Formatura — auditoria, regras e operação

Coordenação → **Formatura** (`/coordenacao/formatura`). Documento escrito em 03/11/2026, junto com a implementação.

## 1. Auditoria do que o sistema já tinha

**Arquitetura.** Next.js (App Router) + Supabase (Postgres, RLS) + Netlify. Autorização em duas camadas: `can()`/`canAccessArea()` na aplicação (`src/authorization/policies.ts`) e RLS no banco. Telas em `src/app/(app)/…`, regras em `src/modules/<área>/`, testes em `tests/unit`. Não há ORM: consultas pelo cliente do Supabase com tipos gerados (`src/integrations/supabase/types.ts`).

**Estrutura acadêmica encontrada.** `volumes` (Essência, Caminho, Voz; pré-requisito encadeado em `volume_prerequisites`), `seasons`, `season_volume_offerings` (volume numa temporada), `classes`/`class_meetings`, `enrollments` (status `active`, `regularization`, `approved`, `failed`, `canceled`, `withdrawn`, com `final_grade` e `final_attendance_percent`), `assessments`/`assessment_attempts` (final e recuperação), `attendance_*` (QR, lançamento manual, reposição, autodeclaração, pedidos), `enrollment_requests` (inscrição, com CPF só em hash e `prerequisite_declaration` em texto livre).

**Regras de aprovação já implementadas (reaproveitadas, nenhuma inventada).**

| Regra | Onde está | Valor |
|---|---|---|
| Frequência mínima | `MIN_ATTENDANCE_RATIO` em `modules/attendance/progress.ts` | 75% das 16 h do volume |
| Nota mínima | `assessments.passing_grade` (`isGradeSufficient`) | 6,0 em 10,0 (por avaliação) |
| Nota do aluno | `private.finalize_attempt_scoring` / `resolveFinalGrade` | a maior entre final e recuperação |
| Recuperação | tabelas `assessments` (tipo `recovery`) e `recovery_path_items` | não depende do resultado da final |
| Tentativa excepcional | `assessment_exceptional_grants` | concedida pela coordenação |
| "Módulo concluído" | `enrollments.status = 'approved'` (usado em `checkPrerequisites`) | ver lacuna abaixo |

**Lacunas e riscos encontrados (dados reais em 03/11/2026).**

1. **Nada marca um módulo como concluído.** Nenhuma função, tela ou rotina muda `enrollments.status` para `approved`: há 0 matrículas assim. `final_attendance_percent` nunca é preenchido. O pré-requisito de matrícula (`getApprovedVolumeIds`) depende, portanto, de status que ninguém grava.
2. **Só existe a temporada 2026.2 na plataforma.** Essência e Caminho de temporadas anteriores não estão em nenhuma tabela. Dos 38 candidatos em Voz, apenas 1 tem matrícula de Essência e 1 de Caminho; 35 escreveram uma frase livre na inscrição (“Sim, cursei essência”), que é pista, não prova.
3. **Avaliações.** Em 03/11: 7 de 38 com nota em Voz (todas suficientes); 30 ainda sem avaliação; as finais vão até 12/11. As recuperações continuam em rascunho.
4. **Duplicidades.** O sistema já detecta e-mail igual em duas contas (`data_quality_report`) e a regra “uma conta por pessoa” (CPF). Nada mescla automaticamente.
5. **Certificados.** Não existe emissão nem tabela de certificados. A Central apenas prepara os dados.

**Conclusão da auditoria.** A fonte confiável de conclusão hoje é: frequência (≥75%) + nota (≥ mínimo da avaliação) comprovadas na plataforma, ou matrícula `approved`, ou **histórico validado por administrador** (nova tabela). Para o histórico anterior à plataforma, a única forma honesta de comprovar é a validação com origem e evidência.

## 2. Como a elegibilidade é decidida

Calculada **a cada consulta** (nunca guardada) por `src/modules/graduation/eligibility.ts` — função pura, sem banco nem tela. Por isso o painel não mostra resultado velho como definitivo; “Reverificar situação acadêmica” apenas força novo cálculo e não altera registro algum.

Por módulo, a prova de conclusão segue esta ordem: (1) matrícula `approved`; (2) histórico validado vigente; (3) frequência + nota na plataforma; (4) nada comprova → **Em conferência** (a declaração da inscrição aparece como pista, nunca como prova).

Estados do aluno, em ordem de prioridade: **Não apto** (impedimento confirmado) › **Com pendências** (regularizável) › **Em conferência** (faltam evidências) › **Em andamento** (aulas ou avaliação ainda não encerradas) › **Apto** (os três módulos comprovados e nenhuma pendência). Todas as pendências são listadas, nenhuma é escondida por outra.

| Situação | Resultado | Motivo da regra |
|---|---|---|
| Avaliação final não feita, janela aberta | Pendente | regularizável pelo próprio aluno |
| Janela encerrada sem tentativa | Pendente | depende de tentativa excepcional da coordenação |
| Nota abaixo do mínimo com recuperação ainda não feita | Pendente | há caminho aberto |
| Nota abaixo do mínimo, recuperação feita e abaixo, ou matrícula `failed` | Não apto | sem caminho aberto |
| Tentativa em andamento | Em andamento | resultado ainda não existe |
| Tentativa vencida e não encerrada | Em conferência | aguardar o encerramento automático |
| Frequência abaixo de 75% | Pendente (reposição/ajuste) | a coordenação pode regularizar |
| Frequência abaixo e pedidos de presença sem decisão | Em conferência | resultado só é definitivo após a análise |
| Frequência abaixo e matrícula `failed` | Não apto | decisão já tomada |
| Possível duplicata (mesmo CPF ou e-mail em outro cadastro) | Em conferência | nunca mescla sozinho |

“Não apto” só é produzido por fatos já registrados (matrícula não aprovada ou recuperação esgotada); o motor não reprova por falta de dado.

## 3. O que foi criado

**Banco (migração `00000000000085_graduation.sql`, aditiva — não altera nenhuma tabela existente):** `graduation_editions`, `graduation_participants` (convite, resposta, comparecimento, nome do certificado; único por edição+aluno), `graduation_follow_ups` (acompanhamento operacional por aluno e por pendência), `graduation_contacts` (histórico de contatos, só cresce), `graduation_history_records` (histórico validado: imutável, revogável, um vigente por aluno+módulo), `graduation_audit` (auditoria por gatilho). Função `graduation_respond` para o aluno responder ao convite. RLS: coordenação/administrador leem e escrevem; só o administrador valida histórico; o aluno vê apenas a própria participação (depois do convite), a edição publicada a que foi convidado e o próprio histórico vigente, e nunca escreve direto.

**Permissões (`graduation:*`):** ver, contatar, configurar e registrar respostas e exportar → coordenação e administrador; **validar histórico → só administrador**. Checadas no servidor em toda ação e na rota de exportação, além da RLS.

**Telas:** Visão geral (indicadores clicáveis, distribuição das pendências, conflitos de convite, filtros combináveis, tabela com seleção), Regularização (abas, ordem de trabalho, mensagem de WhatsApp), Ficha do candidato (jornada, “o que falta”, contato, acompanhamento, histórico validado, participação, auditoria), Cerimônia (dados, publicação, convites, confirmações, comparecimento), Relatórios (8 listas, CSV/XLSX, impressão, conferência do nome do certificado). Aluno: `/formatura` e aviso na página inicial.

## 4. Operação (passo a passo)

1. Coordenação → **Formatura**. Na primeira vez, **Criar edição** (nome + temporada de referência 2026.2): os alunos com matrícula em Voz viram candidatos.
2. A **Visão geral** responde “quantos aptos / pendentes / em conferência / não aptos / a uma pendência de apto”. Clique num número para abrir a lista.
3. **Histórico:** como Essência e Caminho de temporadas anteriores não estão na plataforma, o administrador seleciona alunos na tabela e usa **Validar histórico dos selecionados** (origem + evidência). Também há o formulário individual na ficha.
4. **Regularização:** abre a fila (primeiro quem está a uma pendência). Na ficha: **Entrar em contato** abre o WhatsApp com a mensagem pronta (nada é enviado sozinho); depois de enviar, **Registrar contato**. O acompanhamento é operacional e **não torna o aluno apto**: “Regularizado” só conta quando os registros mostram apto.
5. **Cerimônia:** preencher data, horário, local, endereço e prazo → **Publicar** (o sistema recusa se faltar campo). **Convidar os aptos** (a aptidão é conferida de novo na hora). Os alunos convidados respondem em `/formatura`; a coordenação também registra respostas recebidas por WhatsApp/pessoalmente.
6. Se data ou local mudarem depois de publicar, o sistema avisa quantos já confirmaram; a mudança fica na auditoria.
7. **Relatórios:** listas (aptos, convidados, confirmados, sem resposta, final, concluíram mas não participarão, certificados) em CSV/XLSX; a lista final tem versão para impressão. Confira os nomes dos certificados antes de produzir.

## 5. Decisões e limites

- Convites condicionais **não existem**; só aptos são convidados.
- Confirmar presença nunca altera dado acadêmico; recusar mantém o aluno apto, fora da lista final.
- A lista final exige confirmação **e** aptidão atual; quem deixou de ser apto após o convite aparece como **conflito**, não some.
- O aluno vê andamento por módulo (sem “apto”, sem motivos internos nem nomes de terceiros): a RLS o impede de ver duplicidades e conferências, e um “apto” calculado com dados parciais enganaria.
- Envio automático de WhatsApp: **não implementado** (pedido explícito).
- Certificado: apenas preparação de dados.

## 6. Pendências de decisão da coordenação

1. **Quem marca um módulo como concluído daqui para frente?** Hoje ninguém grava `approved`. Sugestão: ao encerrar a temporada, uma ação da coordenação que conclua as matrículas que cumpriram frequência e nota (assim o pré-requisito e a Formatura usam a mesma fonte).
2. **Histórico de Essência e Caminho dos 37 candidatos:** localizar as listas de 2025 e 2026.1 e validar em lote.
3. **Recuperação:** abrir (e para quem) depois do fim das finais, em 12/11.
4. **Datas da cerimônia:** nenhuma foi definida; nada é mostrado aos alunos até a publicação.
5. **Prazo de regularização da edição** (hoje cada acompanhamento tem o próprio prazo).
