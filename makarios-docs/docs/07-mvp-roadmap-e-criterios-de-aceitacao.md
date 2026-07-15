# MVP, roadmap e critérios de aceitação

## 1. Estratégia de desenvolvimento

Não construir tudo em uma única etapa.

A implementação deve ocorrer por fases, com validação funcional ao final de cada uma.

## 2. Fase 0 — Planejamento técnico

Entregáveis:

- leitura dos documentos;
- inventário dos arquivos visuais;
- arquitetura proposta;
- modelo de dados;
- matriz de permissões;
- plano de implementação;
- riscos;
- decisões técnicas pendentes.

Critério:

- não iniciar código de produção antes de concluir esta fase.

## 3. Fase 1 — Fundação

Funcionalidades:

- estrutura do projeto;
- banco;
- autenticação;
- convite;
- recuperação de senha;
- múltiplos perfis;
- permissões;
- design system;
- ambientes;
- auditoria básica.

Critérios:

- usuário acessa apenas recursos permitidos;
- mesma conta alterna entre perfis;
- credenciais ficam fora do código;
- telas básicas funcionam no celular.

## 4. Fase 2 — Administração acadêmica

Funcionalidades:

- volumes;
- temporadas;
- turmas;
- modelos de horário;
- encontros;
- professores;
- alunos;
- matrículas;
- pré-requisitos;
- exceções;
- importação XLSX e CSV.

Critérios:

- criar 2026.2;
- criar os três volumes;
- criar turma terça/quinta;
- criar turma sábado;
- matricular aluno;
- matricular em dois volumes;
- bloquear pré-requisito;
- liberar exceção;
- importar planilha com relatório de erros.

## 5. Fase 3 — Conteúdo e área do aluno

Funcionalidades:

- módulos;
- aulas;
- conteúdos;
- arquivos;
- YouTube;
- regras de liberação;
- dashboard;
- volumes;
- aula;
- progresso;
- exercícios;
- agenda.

Critérios:

- aluno vê apenas matrícula autorizada;
- conteúdo é liberado gradualmente;
- progresso do vídeo é salvo;
- exercício obrigatório não altera média;
- conteúdo complementar não bloqueia conclusão;
- volume concluído permanece acessível.

## 6. Fase 4 — Área do professor

Funcionalidades:

- dashboard;
- agenda;
- turmas;
- preparação da aula;
- materiais;
- frequência;
- relatório pós-aula.

Critérios:

- professor vê apenas suas turmas;
- registra presença;
- registra presença parcial;
- não edita conteúdo;
- não vê dados financeiros;
- relatório chega à coordenação.

## 7. Fase 5 — Avaliações e recuperação

Funcionalidades:

- banco de questões;
- construtor de exercício;
- avaliação final;
- cronômetro;
- salvamento;
- correção automática;
- resultado;
- gabarito;
- percurso de revisão;
- recuperação;
- tentativa excepcional.

Critérios:

- avaliação usa 20 questões;
- tempo de 60 minutos;
- janela de 14 dias;
- média 6;
- nenhuma questão discursiva;
- recuperação usa 20 questões diferentes;
- gabarito respeita regra;
- nota maior da recuperação substitui regular.

## 8. Fase 6 — Frequência e reposição

Funcionalidades:

- cálculo por minutos acadêmicos;
- equivalência;
- solicitação;
- análise;
- reposição futura;
- validação;
- regularização.

Critérios:

- 12 de 16 horas resulta em 75%;
- intervalo não conta;
- sábado pode equivaler a dois encontros;
- reposição não altera matrícula antes da validação;
- histórico da frequência é auditado.

## 9. Fase 7 — Certificados e comunicação

Funcionalidades:

- Titan SMTP;
- convites;
- notificações;
- comunicados;
- certificado de volume;
- certificado completo;
- QR Code;
- validação pública.

Critérios:

- e-mails saem pelo endereço institucional;
- senha SMTP não está no repositório;
- certificado só é liberado após validação;
- ausência na formatura não bloqueia certificado completo;
- código público valida autenticidade.

## 10. Fase 8 — Dashboards, relatórios e estabilização

Funcionalidades:

- indicadores;
- filtros;
- relatórios PDF;
- relatórios em planilha;
- auditoria;
- testes;
- acessibilidade;
- performance;
- backup;
- deploy.

Critérios:

- dashboard usa dados reais;
- relatórios respeitam filtros;
- ações críticas aparecem na auditoria;
- fluxos principais funcionam no celular;
- não existem permissões apenas visuais;
- sistema possui testes dos cálculos acadêmicos.

## 11. Critérios globais do MVP

O MVP estará pronto quando:

1. a temporada 2026.2 puder ser configurada;
2. os volumes Essência, Caminho e Voz estiverem cadastrados;
3. turmas de terça/quinta e sábado puderem ser criadas;
4. alunos puderem ser importados;
5. matrículas simultâneas funcionarem;
6. pré-requisitos e exceções funcionarem;
7. conteúdos puderem ser liberados gradualmente;
8. YouTube incorporado registrar progresso;
9. exercícios obrigatórios funcionarem;
10. avaliação final calcular nota;
11. recuperação funcionar;
12. frequência usar carga horária;
13. reposição funcionar entre turmas e temporadas;
14. coordenação validar aprovação;
15. certificado por volume for gerado;
16. formação completa considerar os três volumes;
17. formatura não bloquear o certificado;
18. professores acessarem apenas suas turmas;
19. dashboards exibirem dados reais;
20. telas principais funcionarem no celular.

## 12. Itens da segunda fase

- QR Code de presença;
- WhatsApp;
- aplicativo instalável;
- conteúdo offline;
- favoritos;
- anotações pessoais;
- busca global;
- biblioteca avançada;
- múltiplas igrejas;
- dashboards analíticos avançados;
- automações pedagógicas mais complexas.
