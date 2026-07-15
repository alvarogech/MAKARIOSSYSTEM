# Modelo de dados conceitual

Este documento descreve entidades e relações. Não define ainda a tecnologia do banco.

## 1. Identidade e acesso

### `users`

Campos principais:

- id;
- nome;
- email;
- telefone;
- data_nascimento;
- foto_url;
- status;
- ultimo_acesso;
- created_at;
- updated_at.

### `roles`

- id;
- nome;
- descrição.

Valores iniciais:

- student;
- teacher;
- coordinator;
- admin;
- content_editor.

### `user_roles`

Relação muitos-para-muitos entre usuário e perfil.

### `permissions`

- recurso;
- ação;
- descrição.

### `role_permissions`

Relação entre perfil e permissão.

### `invitations`

- usuário;
- token;
- expiração;
- status;
- enviado_em;
- aceito_em.

### `password_reset_tokens`

Tokens temporários para recuperação de senha.

### `sessions`

Sessões ativas, quando aplicável.

## 2. Instituição e estrutura acadêmica

### `institutions`

No MVP haverá apenas Igreja Emaús.

### `schools`

Registro da Escola Makários.

### `volumes`

- Essência;
- Caminho;
- Voz;
- ordem;
- descrição;
- carga_presencial;
- ativo.

### `volume_prerequisites`

- volume;
- volume_prerequisito.

### `prerequisite_exceptions`

- aluno;
- volume;
- requisito pendente;
- justificativa;
- responsável;
- data.

### `modules`

Divisões internas dos volumes.

### `lessons`

Aulas ou unidades dentro dos módulos.

### `academic_units`

Unidades acadêmicas usadas para equivalência de conteúdo e reposição.

### `seasons`

Exemplo: 2026.2.

Campos:

- nome;
- semestre;
- data_inicio;
- data_fim;
- status;
- período de avaliação;
- período de recuperação.

### `class_templates`

Modelos de horário:

- terça e quinta;
- sábado;
- personalizado.

### `classes`

Turmas.

Campos:

- volume;
- temporada;
- nome;
- modelo;
- local;
- capacidade;
- status.

### `class_meetings`

Encontros presenciais.

Campos:

- turma;
- unidade acadêmica;
- data;
- início;
- fim;
- minutos de intervalo;
- minutos acadêmicos;
- local;
- status.

### `teacher_assignments`

Vínculo do professor com:

- turma;
- encontro;
- função.

## 3. Alunos e matrículas

### `enrollments`

Campos:

- aluno;
- volume;
- temporada;
- turma principal;
- status;
- data de autorização;
- autorizado por;
- data de conclusão;
- nota final;
- frequência final.

Restrição recomendada:

- evitar duplicidade de aluno + volume + temporada, salvo exceção explícita.

### `enrollment_status_history`

Histórico de mudança de status.

### `enrollment_progress`

Resumo do progresso, caso seja necessário materializar dados.

### `student_notes`

Observações com nível de visibilidade:

- admin;
- coordenação;
- professor;
- aluno.

## 4. Conteúdo

### `contents`

Campos:

- título;
- descrição;
- tipo;
- volume;
- módulo;
- aula;
- classificação;
- público;
- obrigatório;
- duração estimada;
- ordem;
- status;
- permite download.

### `content_files`

Arquivos vinculados ao conteúdo.

### `video_contents`

- URL do YouTube;
- ID do vídeo;
- percentual mínimo;
- duração;
- miniatura.

### `release_rules`

Tipos:

- imediato;
- data;
- conclusão de conteúdo;
- conclusão de exercício;
- após encontro;
- manual;
- turma;
- aluno.

### `content_progress`

Por matrícula e conteúdo:

- iniciado;
- percentual;
- última posição;
- concluído;
- data de conclusão.

## 5. Exercícios e avaliações

### `question_bank`

Campos:

- enunciado;
- tipo;
- volume;
- módulo;
- aula;
- tema;
- dificuldade;
- explicação;
- referência bíblica;
- status;
- autor.

### `question_options`

Alternativas e indicação da resposta correta.

### `activities`

Usado para exercícios de fixação.

### `activity_questions`

Questões selecionadas e ordem.

### `activity_attempts`

- matrícula;
- atividade;
- início;
- envio;
- quantidade de acertos;
- status.

### `activity_answers`

Respostas do aluno.

### `assessments`

Campos:

- volume;
- temporada;
- tipo: final ou recovery;
- quantidade de questões;
- duração;
- nota mínima;
- abertura;
- encerramento;
- regras do gabarito;
- status.

### `assessment_questions`

Questões e valores.

### `assessment_attempts`

- matrícula;
- avaliação;
- início;
- fim;
- status;
- nota;
- tentativa;
- cancelada;
- motivo de cancelamento.

### `assessment_answers`

Respostas da tentativa.

### `recovery_paths`

Percurso de revisão vinculado à matrícula.

### `recovery_path_items`

Conteúdos e exercícios obrigatórios antes da recuperação.

## 6. Frequência e reposição

### `attendance_records`

- matrícula;
- encontro;
- status;
- minutos reconhecidos;
- observação;
- registrado por;
- data.

### `attendance_change_history`

- valor anterior;
- valor novo;
- justificativa;
- responsável.

### `meeting_equivalences`

Relação muitos-para-muitos entre encontros ou unidades acadêmicas.

Deve permitir equivalência parcial.

Campos sugeridos:

- encontro_origem;
- encontro_destino;
- minutos equivalentes;
- observação.

### `makeup_requests`

- matrícula;
- ausência;
- encontro solicitado;
- status;
- solicitado em;
- analisado por;
- motivo de recusa;
- validado em.

### `makeup_attendance`

Registro da presença na reposição e aplicação à matrícula original.

## 7. Certificados

### `certificate_templates`

- tipo;
- arquivo base;
- campos;
- assinaturas;
- versão.

### `certificates`

- aluno;
- matrícula ou formação completa;
- código;
- QR Code;
- data de emissão;
- status;
- arquivo PDF;
- invalidado em;
- motivo.

### `formation_status`

Resumo da conclusão dos três volumes.

## 8. Comunicação

### `announcements`

- título;
- corpo;
- público;
- envio agendado;
- autor;
- status.

### `announcement_targets`

- perfil;
- volume;
- temporada;
- turma;
- usuário.

### `notifications`

Notificações internas.

### `notification_reads`

Controle de leitura.

### `email_logs`

- destinatário;
- tipo;
- status;
- erro;
- enviado em.

## 9. Auditoria

### `audit_logs`

Campos:

- usuário;
- ação;
- entidade;
- entidade_id;
- valor anterior;
- valor novo;
- justificativa;
- data;
- IP, quando apropriado.

## 10. Importações

### `imports`

- arquivo;
- tipo;
- usuário responsável;
- status;
- resumo;
- data.

### `import_rows`

- número da linha;
- dados;
- status;
- erros;
- usuário criado;
- matrícula criada.

## 11. Relações essenciais

```text
User 1:N Enrollment
User N:N Role
Volume 1:N Module
Module 1:N Lesson
Volume 1:N Season offering
Season 1:N Class
Class 1:N Meeting
Enrollment N:1 Class
Enrollment 1:N Attendance
Enrollment 1:N ContentProgress
Enrollment 1:N AssessmentAttempt
Enrollment 1:N MakeupRequest
Enrollment 1:N Certificate
```

## 12. Restrições importantes

- e-mail único por usuário;
- um professor só acessa turmas vinculadas;
- um aluno só acessa conteúdo de matrícula autorizada;
- nota e frequência não podem ser alteradas sem auditoria;
- certificado deve possuir código único;
- questões usadas na recuperação devem ser diferentes das regulares;
- exclusões acadêmicas importantes devem preferir arquivamento;
- dados financeiros não devem existir no escopo acadêmico do MVP.
