# Regras finais de negócio

Este é o documento de maior prioridade da Plataforma Makários.

## 1. Matrículas

1. Um usuário pode possuir várias matrículas.
2. Cada matrícula pertence a:
   - um volume;
   - uma temporada;
   - uma turma principal.
3. Um aluno pode cursar dois volumes simultaneamente.
4. Cada matrícula possui frequência, progresso, avaliação, recuperação, certificado e status independentes.
5. Não haverá pagamento dentro da plataforma.
6. A matrícula será criada pela administração ou coordenação, manualmente ou por importação.
7. Não haverá matrícula pública no MVP.

## 2. Pré-requisitos

A sequência padrão será:

```text
Essência → Caminho → Voz
```

Regras:

- Essência é pré-requisito para Caminho.
- Caminho é pré-requisito para Voz.
- A coordenação pode autorizar exceção individual.
- A exceção deve registrar:
  - aluno;
  - volume solicitado;
  - pré-requisito pendente;
  - justificativa;
  - responsável;
  - data e hora.
- Toda exceção deve ser auditada.

## 3. Conteúdos

1. Todo o conteúdo pode ser cadastrado antecipadamente.
2. O acesso será liberado gradualmente.
3. A liberação poderá ocorrer:
   - por data;
   - após encontro presencial;
   - após conclusão de conteúdo;
   - após envio de exercício obrigatório;
   - manualmente;
   - por turma;
   - por aluno.
4. O conteúdo futuro poderá aparecer bloqueado ou ficar oculto.
5. O acesso a volumes concluídos permanecerá disponível enquanto a conta estiver ativa.
6. A coordenação poderá retirar, substituir ou restringir materiais específicos.
7. Cada conteúdo poderá ser:
   - obrigatório;
   - complementar;
   - preparatório;
   - aprofundamento;
   - revisão;
   - exclusivo de professor;
   - exclusivo de coordenação;
   - exclusivo de administração.

## 4. Vídeos

1. Os vídeos serão hospedados no YouTube como não listados.
2. Devem ser incorporados na plataforma.
3. O link não deve ser exibido de forma destacada.
4. Vídeos podem ser obrigatórios ou complementares.
5. O percentual mínimo padrão para conclusão será 80%, configurável por conteúdo.
6. O sistema deve registrar:
   - início;
   - última posição;
   - percentual;
   - conclusão;
   - data de conclusão.
7. O YouTube não listado não oferece proteção absoluta; essa limitação é aceita no MVP.

## 5. Exercícios de fixação

1. Exercícios obrigatórios não valem nota.
2. Devem ser enviados para serem considerados concluídos.
3. Podem bloquear o avanço.
4. Podem permitir tentativas ilimitadas.
5. Podem exibir correção e explicações após o envio.
6. Tipos permitidos:
   - múltipla escolha;
   - verdadeiro ou falso;
   - associação;
   - ordenação;
   - preenchimento com opções predefinidas.
7. Não haverá questões discursivas.

## 6. Avaliação final

Cada volume terá uma única avaliação final.

Configuração padrão:

- 20 questões;
- 60 minutos;
- 14 dias corridos de disponibilidade;
- nota total de 10 pontos;
- média mínima de 6,0;
- uma tentativa regular;
- correção automática;
- nenhuma questão discursiva;
- questões com peso igual por padrão;
- embaralhamento de questões e alternativas configurável.

A avaliação poderá ser liberada quando:

- as aulas presenciais tiverem terminado;
- a data programada tiver chegado;
- exercícios obrigatórios tiverem sido concluídos;
- conteúdos obrigatórios tiverem sido concluídos;
- a coordenação fizer liberação manual.

A frequência insuficiente não impede a realização da avaliação.

## 7. Gabarito

O gabarito será liberado quando ocorrer primeiro:

1. todos os alunos aptos enviarem;
2. o prazo da avaliação terminar;
3. a coordenação liberar manualmente.

Antes da liberação, o aluno pode ver:

- nota;
- quantidade de acertos;
- status;
- temas que precisam de revisão.

Depois da liberação, pode ver:

- questão;
- resposta marcada;
- resposta correta;
- explicação;
- referência bíblica;
- conteúdo relacionado.

## 8. Recuperação

A recuperação terá caráter formativo.

Configuração padrão:

- 20 questões diferentes da avaliação regular;
- mesmos objetivos de aprendizagem;
- 60 minutos;
- 14 dias corridos;
- correção automática;
- nota total de 10 pontos;
- média mínima de 6,0;
- uma tentativa;
- uma tentativa excepcional liberada manualmente pela coordenação.

Antes da recuperação, o aluno deve concluir o percurso de revisão definido.

A nota da recuperação substitui a nota regular apenas quando for maior.

O histórico deve guardar:

- nota regular;
- nota da recuperação;
- nota final considerada;
- datas das tentativas.

## 9. Frequência

1. Cada volume possui 16 horas presenciais.
2. Frequência mínima: 75%.
3. Carga mínima: 12 horas.
4. O cálculo deve usar horas acadêmicas, não apenas quantidade de encontros.
5. Intervalos não contam como carga acadêmica.
6. Quem pode registrar:
   - professor;
   - coordenação;
   - administração.
7. Estados:
   - presente;
   - ausente;
   - atrasado;
   - presença parcial;
   - falta justificada;
   - reposição;
   - registro pendente.
8. Presença parcial deve permitir informar minutos ou horas reconhecidas.
9. Alterações devem registrar valor anterior, valor novo, responsável, data e justificativa.

## 10. Modelos de turma

### Modelo A — Terça e quinta

- dias: terça e quinta;
- horário: 19h30 às 21h50;
- intervalo: 20 minutos;
- carga acadêmica: 2 horas por encontro;
- total: 8 encontros;
- carga total: 16 horas.

### Modelo B — Sábado

- dia: sábado;
- horário: 8h às 12h30;
- intervalo: 30 minutos;
- carga acadêmica: 4 horas por encontro;
- total: 4 encontros;
- carga total: 16 horas.

Também poderá existir modelo personalizado.

## 11. Reposição

1. O aluno pode repor em outra turma da mesma temporada.
2. Pode repor em uma temporada futura do mesmo volume.
3. A reposição deve corresponder ao mesmo conteúdo acadêmico.
4. O aluno pode visualizar opções e solicitar.
5. A coordenação aprova, recusa ou sugere alternativa.
6. A reposição só altera a frequência original após validação.
7. Uma equivalência pode ser:
   - um encontro para um encontro;
   - um encontro para vários encontros;
   - vários encontros para um encontro.
8. Um sábado de 4 horas pode equivaler a dois encontros de 2 horas.
9. Estados:
   - necessária;
   - opções disponíveis;
   - solicitada;
   - em análise;
   - aprovada;
   - recusada;
   - realizada;
   - aguardando validação;
   - validada;
   - aguardando temporada futura.

## 12. Aprovação

O sistema não aprova definitivamente de forma automática.

Quando todos os critérios forem cumpridos, a matrícula ficará:

```text
Apta para aprovação
```

A coordenação deverá validar:

- nota final mínima de 6,0;
- frequência mínima de 75%;
- exercícios obrigatórios concluídos;
- conteúdos obrigatórios concluídos;
- reposições regularizadas;
- recuperação concluída, quando aplicável.

Após validação, o status passa para aprovado e o certificado do volume é liberado.

## 13. Certificados

### Certificado por volume

Gerado em PDF após validação da aprovação.

Deve conter:

- nome do aluno;
- volume;
- temporada;
- Escola Makários;
- Igreja Emaús;
- carga presencial;
- carga online oficial;
- carga total;
- data de conclusão;
- código de validação;
- QR Code;
- assinaturas;
- identidade visual oficial.

### Formação completa

O aluno é considerado formado quando concluir:

- Essência;
- Caminho;
- Voz;
- os requisitos acadêmicos dos três volumes;
- a validação final.

A participação na formatura não é obrigatória e não pode bloquear o certificado.

O certificado completo será liberado manualmente pela administração após a validação final, independentemente de presença na cerimônia.

## 14. Acesso do professor

O professor pode ver:

- alunos de suas turmas;
- nome e foto opcional;
- frequência relacionada à turma;
- progresso essencial;
- pendências ligadas às suas aulas;
- observações pedagógicas autorizadas.

O professor não pode ver:

- informações financeiras;
- dados de pagamento;
- observações administrativas restritas;
- histórico de outras turmas;
- auditoria;
- dados pessoais desnecessários.

## 15. Auditoria

Devem ser auditadas, no mínimo:

- alterações de frequência;
- alterações de nota;
- cancelamento de tentativa;
- liberação excepcional;
- exceção de pré-requisito;
- validação de aprovação;
- emissão ou invalidação de certificado;
- alterações de permissões;
- alterações de matrícula;
- publicação ou substituição de conteúdo oficial.
