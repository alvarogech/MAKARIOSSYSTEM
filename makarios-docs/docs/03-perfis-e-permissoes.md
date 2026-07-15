# Perfis e permissões

## 1. Modelo geral

Uma mesma conta pode possuir múltiplos perfis.

Perfis iniciais:

- aluno;
- professor;
- coordenação;
- administrador;
- editor de conteúdo.

O usuário poderá alternar entre perfis sem criar contas duplicadas.

## 2. Aluno

### Pode

- acessar matrículas autorizadas;
- acessar mais de um volume;
- consultar conteúdos liberados;
- assistir vídeos;
- visualizar e baixar materiais permitidos;
- fazer exercícios;
- fazer avaliação e recuperação;
- acompanhar frequência, nota e pendências;
- solicitar reposição;
- consultar volumes concluídos;
- gerar certificados liberados;
- atualizar dados pessoais permitidos.

### Não pode

- acessar volume não autorizado;
- alterar nota ou frequência;
- confirmar a própria reposição;
- acessar materiais restritos;
- editar conteúdos;
- validar aprovação;
- gerar certificado bloqueado.

## 3. Professor

### Pode

- acessar turmas atribuídas;
- acessar encontros atribuídos;
- consultar data, horário e local;
- visualizar e baixar materiais oficiais;
- consultar plano de aula;
- visualizar alunos de suas turmas;
- registrar frequência;
- registrar atraso e presença parcial;
- preencher relatório pós-aula;
- visualizar observações pedagógicas autorizadas.

### Não pode

- alterar conteúdo oficial;
- criar ou editar avaliação;
- alterar critérios acadêmicos;
- gerenciar matrícula;
- validar aprovação;
- emitir certificado;
- acessar informações financeiras;
- corrigir avaliação;
- visualizar dados de outras turmas.

## 4. Coordenação

### Pode

- criar e editar temporadas;
- criar e editar turmas;
- criar encontros;
- designar professores;
- cadastrar e importar alunos;
- criar matrículas;
- autorizar exceção de pré-requisito;
- gerenciar calendário;
- gerenciar conteúdos;
- criar exercícios;
- criar avaliações;
- registrar e corrigir frequência;
- gerenciar reposições;
- liberar recuperação;
- liberar tentativa excepcional;
- validar aprovação;
- liberar certificado de volume;
- consultar relatórios;
- enviar comunicados;
- registrar observações acadêmicas.

## 5. Administrador

Possui todas as permissões da coordenação e também pode:

- gerenciar perfis e permissões;
- suspender e reativar usuários;
- encerrar sessões;
- configurar instituição;
- configurar e-mail;
- configurar certificados;
- configurar regras acadêmicas;
- importar e exportar dados;
- consultar auditoria completa;
- invalidar certificados;
- liberar certificado de formação completa;
- gerenciar editores e coordenadores.

## 6. Editor de conteúdo

### Pode

- criar e editar módulos;
- criar e editar aulas;
- cadastrar vídeos;
- cadastrar PDFs e apresentações;
- criar exercícios;
- criar avaliações;
- editar banco de questões;
- organizar ordem dos conteúdos;
- configurar liberação;
- visualizar como aluno;
- publicar quando autorizado.

### Não pode

- gerenciar matrículas;
- alterar frequência;
- alterar notas;
- validar aprovação;
- emitir certificados;
- gerenciar usuários;
- acessar dados pessoais desnecessários.

## 7. Matriz resumida

| Recurso | Aluno | Professor | Coordenação | Administrador | Editor |
|---|---:|---:|---:|---:|---:|
| Ver conteúdo matriculado | Sim | Conforme turma | Sim | Sim | Sim |
| Editar conteúdo | Não | Não | Sim | Sim | Sim |
| Registrar frequência | Não | Sim | Sim | Sim | Não |
| Corrigir frequência | Não | Não | Sim | Sim | Não |
| Criar matrícula | Não | Não | Sim | Sim | Não |
| Importar alunos | Não | Não | Sim | Sim | Não |
| Criar avaliação | Não | Não | Sim | Sim | Sim |
| Fazer avaliação | Sim | Apenas como aluno | Conforme matrícula | Conforme matrícula | Conforme matrícula |
| Validar aprovação | Não | Não | Sim | Sim | Não |
| Emitir certificado | Baixar quando liberado | Não | Sim | Sim | Não |
| Gerenciar permissões | Não | Não | Não | Sim | Não |
| Ver auditoria | Não | Não | Parcial | Completa | Não |

## 8. Controle de acesso

O controle deverá considerar simultaneamente:

- perfil;
- instituição;
- matrícula;
- temporada;
- turma;
- vínculo do professor;
- regra de liberação;
- status do usuário;
- status da matrícula.

Não confiar apenas na ocultação da interface. As permissões devem ser validadas no backend.
